import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { normalizeName } from '@tecpap/config';
import type { AuditDto, PaginatedResult } from '@tecpap/types';
import type { Prisma } from '@prisma/client';
import type { ActorContext } from '../../common/context/actor';
import { paginated, parsePagination, parseSort } from '../../common/pagination/pagination';
import { departmentScopeWhere } from '../../common/scoping/scope';
import type { DataScope } from '../../common/types/data-scope';
import { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AnswerQuestionDto,
  CreateAuditDto,
  ListAuditsQuery,
  ReviewDto,
} from './dto/audits.dto';

const DETAIL_INCLUDE = {
  template: {
    include: {
      sections: {
        include: { questions: { orderBy: { order: 'asc' } } },
        orderBy: { order: 'asc' },
      },
    },
  },
  answers: true,
  findings: { include: { responsible: { select: { firstName: true, lastName: true } } } },
  evidence: true,
  department: { select: { name: true } },
  process: { select: { name: true } },
  auditor: { select: { firstName: true, lastName: true } },
  approvedBy: { select: { firstName: true, lastName: true } },
} satisfies Prisma.AuditInclude;

const LIST_INCLUDE = {
  template: {
    select: {
      id: true,
      name: true,
      sections: { select: { _count: { select: { questions: true } } } },
    },
  },
  answers: { select: { status: true } },
  department: { select: { name: true } },
  process: { select: { name: true } },
  auditor: { select: { firstName: true, lastName: true } },
  approvedBy: { select: { firstName: true, lastName: true } },
  _count: { select: { findings: true, evidence: true } },
} satisfies Prisma.AuditInclude;

function fullName(user: { firstName: string; lastName: string } | null): string | null {
  return user ? `${user.firstName} ${user.lastName}` : null;
}

function progressOf(answeredStatuses: string[], totalQuestions: number): number {
  if (totalQuestions === 0) return 0;
  const answered = answeredStatuses.filter((status) => status !== 'pending').length;
  return Math.round((answered / totalQuestions) * 100);
}

@Injectable()
export class AuditsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly timeline: ActivityTimelineService,
  ) {}

  async list(
    query: ListAuditsQuery,
    scope: DataScope | undefined,
  ): Promise<PaginatedResult<AuditDto>> {
    const { skip, take, page, pageSize, search } = parsePagination(query);
    const base: Prisma.AuditWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.processId ? { processId: query.processId } : {}),
      ...(query.auditorId ? { auditorId: query.auditorId } : {}),
      ...(query.templateId ? { templateId: query.templateId } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { template: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            scheduledDate: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
            },
          }
        : {}),
    };
    const where = departmentScopeWhere(scope, {
      ...base,
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
    }) as Prisma.AuditWhereInput;
    const [rows, total] = await Promise.all([
      this.prisma.audit.findMany({
        where,
        skip,
        take,
        orderBy: parseSort(query.sort, ['title', 'createdAt', 'status'], { updatedAt: 'desc' }),
        include: LIST_INCLUDE,
      }),
      this.prisma.audit.count({ where }),
    ]);
    return paginated(
      rows.map((row) => this.toListDto(row)),
      total,
      page,
      pageSize,
    );
  }

  async findOne(id: string, scope: DataScope | undefined) {
    const audit = await this.prisma.audit.findFirst({
      where: { id, ...departmentScopeWhere(scope) },
      include: DETAIL_INCLUDE,
    });
    if (!audit) throw new NotFoundException('Audit not found');
    return this.toDetail(audit);
  }

  async create(dto: CreateAuditDto, actor: ActorContext): Promise<AuditDto> {
    const template = await this.prisma.auditTemplate.findUnique({ where: { id: dto.templateId } });
    if (!template) throw new NotFoundException('Template not found');
    if (template.status !== 'PUBLISHED')
      throw new ConflictException('Only published templates can be used to create audits');

    // Business rule: audit scheduled date cannot be in the past
    if (dto.scheduledDate) {
      const scheduled = new Date(dto.scheduledDate);
      if (isNaN(scheduled.getTime())) throw new ConflictException('Invalid scheduled date format');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (scheduled < today)
        throw new ConflictException('Audit scheduled date cannot be in the past');
    }
    await this.assertUniqueTitle(dto.title);

    const audit = await this.prisma.audit.create({
      data: {
        title: dto.title,
        normalizedTitle: normalizeName(dto.title),
        templateId: dto.templateId,
        departmentId: dto.departmentId,
        processId: dto.processId ?? null,
        auditorId: dto.auditorId ?? null,
        status: 'PLANNED',
        scheduledDate: dto.scheduledDate ? new Date(dto.scheduledDate) : null,
        createdById: actor.actorId ?? '',
      },
      include: LIST_INCLUDE,
    });
    await this.record(
      audit.id,
      audit.processId,
      'audit.created',
      `Audit "${audit.title}" scheduled`,
      actor,
    );
    await this.audit(actor, 'audit.create', audit.id, { title: audit.title });
    return this.toListDto(audit);
  }

  /** Start or resume execution. */
  async start(id: string, actor: ActorContext): Promise<AuditDto> {
    const audit = await this.assertStatus(id, ['PLANNED', 'RETURNED']);
    const updated = await this.prisma.audit.update({
      where: { id },
      data: { status: 'IN_PROGRESS', startedAt: audit.startedAt ?? new Date() },
      include: LIST_INCLUDE,
    });
    await this.record(
      id,
      audit.processId,
      'audit.started',
      `Audit "${audit.title}" started`,
      actor,
    );
    return this.toListDto(updated);
  }

  async answer(id: string, dto: AnswerQuestionDto, actor: ActorContext): Promise<void> {
    await this.assertStatus(id, ['IN_PROGRESS', 'RETURNED']);
    await this.prisma.auditAnswer.upsert({
      where: { auditId_questionId: { auditId: id, questionId: dto.questionId } },
      create: {
        auditId: id,
        questionId: dto.questionId,
        value: dto.value as Prisma.InputJsonValue,
        status: dto.status ?? 'pending',
      },
      update: { value: dto.value as Prisma.InputJsonValue, status: dto.status ?? 'pending' },
    });
    await this.recompute(id);
    await this.record(id, null, 'question.answered', `Question answered`, actor);
  }

  async submit(id: string, actor: ActorContext): Promise<AuditDto> {
    await this.assertStatus(id, ['IN_PROGRESS', 'RETURNED']);
    await this.recompute(id);
    const updated = await this.prisma.audit.update({
      where: { id },
      data: { status: 'SUBMITTED', submittedAt: new Date() },
      include: LIST_INCLUDE,
    });
    await this.record(
      id,
      updated.processId,
      'audit.submitted',
      `Audit "${updated.title}" submitted for review`,
      actor,
    );
    await this.audit(actor, 'audit.submit', id);
    return this.toListDto(updated);
  }

  async approve(id: string, dto: ReviewDto, actor: ActorContext): Promise<AuditDto> {
    await this.assertStatus(id, ['SUBMITTED', 'UNDER_REVIEW']);
    const updated = await this.prisma.audit.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedById: actor.actorId,
        reviewComment: dto.comment ?? null,
      },
      include: LIST_INCLUDE,
    });
    await this.record(
      id,
      updated.processId,
      'audit.approved',
      `Audit "${updated.title}" approved`,
      actor,
    );
    await this.audit(actor, 'audit.approve', id);
    return this.toListDto(updated);
  }

  async returnAudit(id: string, dto: ReviewDto, actor: ActorContext): Promise<AuditDto> {
    await this.assertStatus(id, ['SUBMITTED', 'UNDER_REVIEW']);
    const updated = await this.prisma.audit.update({
      where: { id },
      data: { status: 'RETURNED', reviewComment: dto.comment ?? null },
      include: LIST_INCLUDE,
    });
    await this.record(
      id,
      updated.processId,
      'audit.returned',
      `Audit "${updated.title}" returned for corrections`,
      actor,
    );
    await this.audit(actor, 'audit.return', id);
    return this.toListDto(updated);
  }

  async complete(id: string, actor: ActorContext): Promise<AuditDto> {
    await this.assertStatus(id, ['APPROVED']);
    const updated = await this.prisma.audit.update({
      where: { id },
      data: { status: 'COMPLETED' },
      include: LIST_INCLUDE,
    });
    await this.record(
      id,
      updated.processId,
      'audit.completed',
      `Audit "${updated.title}" completed`,
      actor,
    );
    await this.audit(actor, 'audit.complete', id);
    return this.toListDto(updated);
  }

  async remove(id: string, actor: ActorContext): Promise<void> {
    const audit = await this.prisma.audit.findUnique({ where: { id } });
    if (!audit) throw new NotFoundException('Audit not found');
    await this.prisma.audit.delete({ where: { id } });
    await this.audit(actor, 'audit.delete', id);
  }

  /** Snapshot used by the report generator. */
  async snapshotForReport(id: string) {
    const audit = await this.prisma.audit.findUnique({ where: { id }, include: DETAIL_INCLUDE });
    if (!audit) throw new NotFoundException('Audit not found');
    return audit;
  }

  // ----------------------------------------------------------------- internals

  /** Rejects a title already used by another audit (case-insensitive, whitespace-normalized). */
  private async assertUniqueTitle(title: string): Promise<void> {
    const existing = await this.prisma.audit.findFirst({
      where: { normalizedTitle: normalizeName(title) },
      select: { id: true },
    });
    if (existing)
      throw new ConflictException({
        code: 'AUDIT_DUPLICATE_NAME',
        message: 'An audit with this name already exists.',
      });
  }

  private async assertStatus(id: string, allowed: string[]) {
    const audit = await this.prisma.audit.findUnique({ where: { id } });
    if (!audit) throw new NotFoundException('Audit not found');
    if (!allowed.includes(audit.status))
      throw new ConflictException(
        `Audit is ${audit.status}; expected one of ${allowed.join(', ')}`,
      );
    return audit;
  }

  private async recompute(id: string): Promise<void> {
    const audit = await this.prisma.audit.findUnique({
      where: { id },
      include: {
        template: { include: { sections: { include: { questions: { select: { id: true } } } } } },
        answers: { select: { status: true } },
      },
    });
    if (!audit) return;
    const ok = audit.answers.filter((a) => a.status === 'ok').length;
    const fail = audit.answers.filter((a) => a.status === 'fail').length;
    const compliance = ok + fail > 0 ? Math.round((ok / (ok + fail)) * 100) : null;
    await this.prisma.audit.update({ where: { id }, data: { compliance } });
  }

  private toListDto(audit: {
    id: string;
    title: string;
    templateId: string;
    departmentId: string;
    processId: string | null;
    auditorId: string | null;
    status: string;
    scheduledDate: Date | null;
    startedAt: Date | null;
    submittedAt: Date | null;
    approvedAt: Date | null;
    approvedById: string | null;
    score: number | null;
    compliance: number | null;
    createdById: string;
    createdAt: Date;
    updatedAt: Date;
    template: { id: string; name: string; sections: { _count: { questions: number } }[] };
    answers: { status: string }[];
    department: { name: string } | null;
    process: { name: string } | null;
    auditor: { firstName: string; lastName: string } | null;
    approvedBy: { firstName: string; lastName: string } | null | undefined;
    _count: { findings: number; evidence: number };
  }): AuditDto {
    const totalQuestions = audit.template.sections.reduce(
      (sum, section) => sum + section._count.questions,
      0,
    );
    return {
      id: audit.id,
      title: audit.title,
      templateId: audit.templateId,
      templateName: audit.template.name,
      departmentId: audit.departmentId,
      departmentName: audit.department?.name ?? null,
      processId: audit.processId,
      processName: audit.process?.name ?? null,
      auditorId: audit.auditorId,
      auditorName: fullName(audit.auditor),
      status: audit.status as AuditDto['status'],
      scheduledDate: audit.scheduledDate?.toISOString() ?? null,
      startedAt: audit.startedAt?.toISOString() ?? null,
      submittedAt: audit.submittedAt?.toISOString() ?? null,
      approvedAt: audit.approvedAt?.toISOString() ?? null,
      approvedById: audit.approvedById,
      approvedByName: audit.approvedBy ? fullName(audit.approvedBy) : null,
      score: audit.score,
      compliance: audit.compliance,
      progress: progressOf(
        audit.answers.map((a) => a.status),
        totalQuestions,
      ),
      createdById: audit.createdById,
      createdAt: audit.createdAt.toISOString(),
      updatedAt: audit.updatedAt.toISOString(),
    };
  }

  private toDetail(audit: Prisma.AuditGetPayload<{ include: typeof DETAIL_INCLUDE }>) {
    const totalQuestions = audit.template.sections.reduce(
      (sum, section) => sum + section.questions.length,
      0,
    );
    const answered = audit.answers.filter((a) => a.status !== 'pending').length;
    return {
      ...this.toListDto({
        ...audit,
        template: {
          id: audit.template.id,
          name: audit.template.name,
          sections: audit.template.sections.map((section) => ({
            _count: { questions: section.questions.length },
          })),
        },
        _count: { findings: audit.findings.length, evidence: audit.evidence.length },
        approvedBy: audit.approvedBy,
      }),
      questionsTotal: totalQuestions,
      questionsAnswered: answered,
      sections: audit.template.sections.map((section) => ({
        id: section.id,
        title: section.title,
        order: section.order,
        description: section.description,
        questions: section.questions.map((question) => {
          const answer = audit.answers.find((a) => a.questionId === question.id);
          return {
            ...question,
            answer: answer ? { id: answer.id, value: answer.value, status: answer.status } : null,
          };
        }),
      })),
      findings: audit.findings,
      evidence: audit.evidence,
    };
  }

  private async record(
    auditId: string,
    processId: string | null,
    eventType: string,
    title: string,
    actor: ActorContext,
  ): Promise<void> {
    await this.timeline.record({
      processId,
      eventType,
      title,
      entityType: 'audit',
      entityId: auditId,
      actorId: actor.actorId,
    });
  }

  private async audit(
    actor: ActorContext,
    action: string,
    entityId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.auditLog.record({
      actorId: actor.actorId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      action,
      entityType: 'audit',
      entityId,
      metadata: metadata ?? null,
    });
  }
}

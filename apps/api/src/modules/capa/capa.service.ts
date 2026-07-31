import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CAPA_TRANSITIONS, type CapaStatus } from '@tecpap/config';
import type { CapaActionDto, CapaDetailDto, CapaDto, EffectivenessResult, PaginatedResult, VerificationResult } from '@tecpap/types';
import type { Prisma } from '@prisma/client';
import type { ActorContext } from '../../common/context/actor';
import { paginated, parsePagination, parseSort } from '../../common/pagination/pagination';
import { departmentScopeWhere } from '../../common/scoping/scope';
import type { DataScope } from '../../common/types/data-scope';
import { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateCapaDto, ListCapasQuery, UpdateCapaDto } from './dto/capa.dto';

const DETAIL_INCLUDE = {
  department: { select: { name: true } },
  process: { select: { name: true } },
  owner: { select: { firstName: true, lastName: true } },
  createdBy: { select: { firstName: true, lastName: true } },
  closedBy: { select: { firstName: true, lastName: true } },
  finding: { select: { id: true, title: true } },
  rootCause: { include: { whySteps: { orderBy: { stepNumber: 'asc' } }, eightD: true } },
  actions: { include: { owner: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: 'asc' } },
  verification: { include: { verifiedBy: { select: { firstName: true, lastName: true } } } },
  effectiveness: { include: { reviewedBy: { select: { firstName: true, lastName: true } } } },
} satisfies Prisma.CapaInclude;

const LIST_INCLUDE = {
  department: { select: { name: true } },
  process: { select: { name: true } },
  owner: { select: { firstName: true, lastName: true } },
  createdBy: { select: { firstName: true, lastName: true } },
  finding: { select: { title: true } },
  _count: { select: { actions: true } },
  rootCause: { select: { id: true } },
  verification: { select: { id: true } },
  effectiveness: { select: { id: true } },
} satisfies Prisma.CapaInclude;

function fullName(user: { firstName: string; lastName: string } | null): string | null {
  return user ? `${user.firstName} ${user.lastName}` : null;
}

@Injectable()
export class CapaService {
  private seq = 0;
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly timeline: ActivityTimelineService,
  ) {}

  async list(query: ListCapasQuery, scope: DataScope | undefined): Promise<PaginatedResult<CapaDto>> {
    const { skip, take, page, pageSize, search } = parsePagination(query);
    const now = new Date();
    const base: Prisma.CapaWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.processId ? { processId: query.processId } : {}),
      ...(query.ownerId ? { ownerId: query.ownerId } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.sourceType ? { sourceType: query.sourceType } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(search ? { OR: [{ title: { contains: search, mode: 'insensitive' } }, { referenceNumber: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }] } : {}),
      ...(query.overdue === 'true' ? { targetDate: { lt: now }, status: { notIn: ['CLOSED', 'CANCELLED'] } } : {}),
    };
    const where = departmentScopeWhere(scope, base) as Prisma.CapaWhereInput;
    const [rows, total] = await Promise.all([
      this.prisma.capa.findMany({ where, skip, take, orderBy: parseSort(query.sort, ['referenceNumber', 'title', 'createdAt', 'status'], { createdAt: 'desc' }), include: LIST_INCLUDE }),
      this.prisma.capa.count({ where }),
    ]);
    return paginated(rows.map((r) => this.toListDto(r, now)), total, page, pageSize);
  }

  async findOne(id: string, scope: DataScope | undefined): Promise<CapaDetailDto> {
    const capa = await this.prisma.capa.findFirst({ where: { id, ...departmentScopeWhere(scope) }, include: DETAIL_INCLUDE });
    if (!capa) throw new NotFoundException('CAPA not found');
    return this.toDetailDto(capa, new Date());
  }

  async create(dto: CreateCapaDto, actor: ActorContext): Promise<CapaDetailDto> {
    const referenceNumber = await this.generateReference();
    const capa = await this.prisma.capa.create({
      data: {
        referenceNumber, title: dto.title, description: dto.description ?? null,
        sourceType: dto.sourceType ?? 'MANUAL', sourceId: dto.sourceId ?? null, findingId: dto.findingId ?? null,
        departmentId: dto.departmentId, processId: dto.processId ?? null, ownerId: dto.ownerId ?? null,
        createdById: actor.actorId ?? '', priority: dto.priority ?? 'MEDIUM',
        targetDate: dto.targetDate ? new Date(dto.targetDate) : null,
        effectivenessDueDate: dto.effectivenessDueDate ? new Date(dto.effectivenessDueDate) : null,
        rootCause: { create: {} },
      },
      include: DETAIL_INCLUDE,
    });
    await this.timeline.record({ processId: dto.processId, eventType: 'capa.created', title: `${referenceNumber} created`, entityType: 'capa', entityId: capa.id, actorId: actor.actorId });
    await this.audit(actor, 'capa.create', capa.id, { referenceNumber });
    return this.toDetailDto(capa, new Date());
  }

  async update(id: string, dto: UpdateCapaDto, actor: ActorContext): Promise<CapaDetailDto> {
    const current = await this.prisma.capa.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundException('CAPA not found');
    const data: Prisma.CapaUncheckedUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.ownerId !== undefined) data.ownerId = dto.ownerId;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.targetDate !== undefined) data.targetDate = dto.targetDate ? new Date(dto.targetDate) : null;
    if (dto.effectivenessDueDate !== undefined) data.effectivenessDueDate = dto.effectivenessDueDate ? new Date(dto.effectivenessDueDate) : null;
    const updated = await this.prisma.capa.update({ where: { id }, data, include: DETAIL_INCLUDE });
    await this.audit(actor, 'capa.update', id);
    return this.toDetailDto(updated, new Date());
  }

  async transition(id: string, target: CapaStatus, actor: ActorContext): Promise<CapaDetailDto> {
    const current = await this.prisma.capa.findFirst({ where: { id, deletedAt: null }, include: DETAIL_INCLUDE });
    if (!current) throw new NotFoundException('CAPA not found');
    const allowed = CAPA_TRANSITIONS[current.status] ?? [];
    if (!allowed.includes(target)) throw new ConflictException(`Cannot transition CAPA from ${current.status} to ${target}`);

    // Enforce: cannot go to PENDING_VERIFICATION if actions are incomplete
    if (target === 'PENDING_VERIFICATION') {
      const incomplete = current.actions.filter((a) => a.status !== 'COMPLETED' && a.status !== 'VERIFIED' && a.status !== 'CANCELLED');
      if (incomplete.length > 0) throw new ConflictException(`${incomplete.length} action(s) are not completed`);
    }
    // Enforce: cannot close without verification + effectiveness
    if (target === 'CLOSED') {
      if (!current.verification || current.verification.result !== 'PASSED') throw new ConflictException('CAPA must pass verification before closure');
      if (!current.effectiveness || current.effectiveness.result !== 'EFFECTIVE') throw new ConflictException('CAPA must have an effective effectiveness review before closure');
    }

    const now = new Date();
    const data: Prisma.CapaUncheckedUpdateInput = { status: target };
    if (target === 'IN_PROGRESS' && !current.openedAt) data.openedAt = now;
    if (target === 'PENDING_VERIFICATION') data.submittedAt = now;
    if (target === 'CLOSED') data.closedAt = now;

    const updated = await this.prisma.capa.update({ where: { id }, data, include: DETAIL_INCLUDE });
    await this.timeline.record({ processId: current.processId, eventType: `capa.${target.toLowerCase()}`, title: `${current.referenceNumber} → ${target}`, entityType: 'capa', entityId: id, actorId: actor.actorId });
    await this.audit(actor, 'capa.transition', id, { from: current.status, to: target });
    return this.toDetailDto(updated, now);
  }

  async verify(id: string, result: 'PASSED' | 'FAILED', notes: string | null, actor: ActorContext): Promise<CapaDetailDto> {
    const capa = await this.prisma.capa.findFirst({ where: { id, deletedAt: null } });
    if (!capa) throw new NotFoundException('CAPA not found');
    if (capa.status !== 'PENDING_VERIFICATION') throw new ConflictException('CAPA must be in PENDING_VERIFICATION to verify');

    await this.prisma.capaVerification.upsert({
      where: { capaId: id },
      create: { capaId: id, verifiedById: actor.actorId!, result, notes },
      update: { verifiedById: actor.actorId!, result, notes, verifiedAt: new Date() },
    });
    // Auto-transition based on result
    const nextStatus = result === 'PASSED' ? 'PENDING_EFFECTIVENESS' : 'IN_PROGRESS';
    const updated = await this.prisma.capa.update({ where: { id }, data: { status: nextStatus, verifiedAt: result === 'PASSED' ? new Date() : null }, include: DETAIL_INCLUDE });
    await this.timeline.record({ processId: capa.processId, eventType: `capa.verification_${result.toLowerCase()}`, title: `${capa.referenceNumber} verification ${result}`, entityType: 'capa', entityId: id, actorId: actor.actorId });
    await this.audit(actor, `capa.verify_${result.toLowerCase()}`, id, { notes });
    return this.toDetailDto(updated, new Date());
  }

  async reviewEffectiveness(id: string, result: 'EFFECTIVE' | 'PARTIALLY_EFFECTIVE' | 'INEFFECTIVE', notes: string | null, actor: ActorContext): Promise<CapaDetailDto> {
    const capa = await this.prisma.capa.findFirst({ where: { id, deletedAt: null } });
    if (!capa) throw new NotFoundException('CAPA not found');
    if (capa.status !== 'PENDING_EFFECTIVENESS') throw new ConflictException('CAPA must be in PENDING_EFFECTIVENESS to review');

    await this.prisma.capaEffectivenessReview.upsert({
      where: { capaId: id },
      create: { capaId: id, reviewedById: actor.actorId!, result, notes },
      update: { reviewedById: actor.actorId!, result, notes, reviewedAt: new Date() },
    });
    // Only EFFECTIVE permits closure path; others reopen
    const nextStatus = result === 'EFFECTIVE' ? 'PENDING_EFFECTIVENESS' : 'IN_PROGRESS';
    const updated = await this.prisma.capa.update({ where: { id }, data: { status: nextStatus, effectivenessReviewedAt: new Date() }, include: DETAIL_INCLUDE });
    await this.timeline.record({ processId: capa.processId, eventType: `capa.effectiveness_${result.toLowerCase()}`, title: `${capa.referenceNumber} effectiveness: ${result}`, entityType: 'capa', entityId: id, actorId: actor.actorId });
    await this.audit(actor, `capa.effectiveness_${result.toLowerCase()}`, id, { notes });
    return this.toDetailDto(updated, new Date());
  }

  async close(id: string, closureComment: string | null, actor: ActorContext): Promise<CapaDetailDto> {
    return this.transitionWithChecks(id, 'CLOSED', actor, { closureComment: closureComment ?? undefined });
  }

  private async transitionWithChecks(id: string, target: CapaStatus, actor: ActorContext, extra?: { closureComment?: string }): Promise<CapaDetailDto> {
    const current = await this.prisma.capa.findFirst({ where: { id, deletedAt: null }, include: DETAIL_INCLUDE });
    if (!current) throw new NotFoundException('CAPA not found');
    if (!(CAPA_TRANSITIONS[current.status] ?? []).includes(target)) throw new ConflictException(`Cannot transition CAPA from ${current.status} to ${target}`);
    if (target === 'CLOSED') {
      if (!current.verification || current.verification.result !== 'PASSED') throw new ConflictException('Verification must pass before closure');
      if (!current.effectiveness || current.effectiveness.result !== 'EFFECTIVE') throw new ConflictException('Effectiveness must be EFFECTIVE before closure');
    }
    const now = new Date();
    const updated = await this.prisma.capa.update({ where: { id }, data: { status: target, closedAt: target === 'CLOSED' ? now : null, closedById: target === 'CLOSED' ? actor.actorId : undefined, closureComment: extra?.closureComment ?? undefined } as Prisma.CapaUncheckedUpdateInput, include: DETAIL_INCLUDE });
    await this.timeline.record({ processId: current.processId, eventType: `capa.${target.toLowerCase()}`, title: `${current.referenceNumber} → ${target}`, entityType: 'capa', entityId: id, actorId: actor.actorId });
    await this.audit(actor, 'capa.transition', id, { from: current.status, to: target });
    return this.toDetailDto(updated, now);
  }

  async updateRootCause(id: string, dto: Partial<{ problemStatement: string | null; immediateCause: string | null; rootCause: string | null; contributingFactors: string | null; analysisNotes: string | null; useFiveWhys: boolean; useEightD: boolean }>, actor: ActorContext): Promise<CapaDetailDto> {
    const capa = await this.prisma.capa.findFirst({ where: { id, deletedAt: null } });
    if (!capa) throw new NotFoundException('CAPA not found');
    await this.prisma.capaRootCauseAnalysis.upsert({
      where: { capaId: id },
      create: { capaId: id, ...dto },
      update: { ...dto },
    });
    const updated = await this.prisma.capa.findUnique({ where: { id }, include: DETAIL_INCLUDE });
    await this.timeline.record({ processId: capa.processId, eventType: 'capa.root_cause_updated', title: `${capa.referenceNumber} root cause updated`, entityType: 'capa', entityId: id, actorId: actor.actorId });
    return this.toDetailDto(updated!, new Date());
  }

  async addWhyStep(id: string, question: string, answer: string | null, actor: ActorContext): Promise<CapaDetailDto> {
    const capa = await this.prisma.capa.findFirst({ where: { id, deletedAt: null }, include: { rootCause: { include: { whySteps: true } } } });
    if (!capa || !capa.rootCause) throw new NotFoundException('CAPA or root cause not found');
    const nextStep = (capa.rootCause.whySteps.at(-1)?.stepNumber ?? 0) + 1;
    await this.prisma.capaWhyStep.create({ data: { analysisId: capa.rootCause.id, stepNumber: nextStep, question, answer } });
    return this.toDetailDto((await this.prisma.capa.findUnique({ where: { id }, include: DETAIL_INCLUDE }))!, new Date());
  }

  async deleteWhyStep(id: string, stepId: string): Promise<CapaDetailDto> {
    await this.prisma.capaWhyStep.delete({ where: { id: stepId } });
    return this.toDetailDto((await this.prisma.capa.findUnique({ where: { id }, include: DETAIL_INCLUDE }))!, new Date());
  }

  async updateEightD(id: string, dto: Record<string, string | null>, actor: ActorContext): Promise<CapaDetailDto> {
    const capa = await this.prisma.capa.findFirst({ where: { id, deletedAt: null }, include: { rootCause: { include: { eightD: true } } } });
    if (!capa || !capa.rootCause) throw new NotFoundException('CAPA or root cause not found');
    await this.prisma.capaEightD.upsert({
      where: { analysisId: capa.rootCause.id },
      create: { analysisId: capa.rootCause.id, ...dto },
      update: { ...dto },
    });
    return this.toDetailDto((await this.prisma.capa.findUnique({ where: { id }, include: DETAIL_INCLUDE }))!, new Date());
  }

  async snapshotForReport(id: string) {
    const capa = await this.prisma.capa.findUnique({ where: { id }, include: DETAIL_INCLUDE });
    if (!capa) throw new NotFoundException('CAPA not found');
    return capa;
  }

  async remove(id: string, actor: ActorContext): Promise<void> {
    const capa = await this.prisma.capa.findFirst({ where: { id, deletedAt: null } });
    if (!capa) throw new NotFoundException('CAPA not found');
    await this.prisma.capa.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit(actor, 'capa.delete', id);
  }

  private async generateReference(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.capa.count({ where: { referenceNumber: { startsWith: `CAPA-${year}-` } } });
    return `CAPA-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  private toListDto(capa: Prisma.CapaGetPayload<{ include: typeof LIST_INCLUDE }>, now: Date): CapaDto {
    return {
      id: capa.id, referenceNumber: capa.referenceNumber, title: capa.title, description: capa.description,
      sourceType: capa.sourceType, sourceId: capa.sourceId, findingId: capa.findingId, findingTitle: capa.finding?.title ?? null,
      departmentId: capa.departmentId, departmentName: capa.department?.name ?? null, processId: capa.processId, processName: capa.process?.name ?? null,
      ownerId: capa.ownerId, ownerName: fullName(capa.owner), createdById: capa.createdById, createdByName: fullName(capa.createdBy),
      priority: capa.priority, status: capa.status, targetDate: capa.targetDate?.toISOString() ?? null,
      openedAt: capa.openedAt?.toISOString() ?? null, submittedAt: capa.submittedAt?.toISOString() ?? null, verifiedAt: capa.verifiedAt?.toISOString() ?? null,
      effectivenessDueDate: capa.effectivenessDueDate?.toISOString() ?? null, effectivenessReviewedAt: capa.effectivenessReviewedAt?.toISOString() ?? null,
      closedAt: capa.closedAt?.toISOString() ?? null, closedById: capa.closedById, closureComment: capa.closureComment,
      isOverdue: capa.targetDate ? capa.targetDate < now && capa.status !== 'CLOSED' && capa.status !== 'CANCELLED' : false,
      actionCount: capa._count.actions,
      completedActionCount: 0,
      hasRootCause: !!capa.rootCause?.id, hasVerification: !!capa.verification?.id, hasEffectivenessReview: !!capa.effectiveness?.id,
      createdAt: capa.createdAt.toISOString(), updatedAt: capa.updatedAt.toISOString(),
    };
  }

  private toDetailDto(capa: Prisma.CapaGetPayload<{ include: typeof DETAIL_INCLUDE }>, now: Date): CapaDetailDto {
    const completedActions = capa.actions.filter((a) => a.status === 'COMPLETED' || a.status === 'VERIFIED').length;
    const base: CapaDto = {
      ...this.toListDto({ ...capa, _count: { actions: capa.actions.length, findings: 0 } } as Prisma.CapaGetPayload<{ include: typeof LIST_INCLUDE }>, now),
      completedActionCount: completedActions,
    };
    const rootCauseData = capa.rootCause;
    return {
      ...base,
      rootCause: rootCauseData ? {
        problemStatement: rootCauseData.problemStatement,
        immediateCause: rootCauseData.immediateCause,
        rootCause: rootCauseData.rootCause,
        contributingFactors: rootCauseData.contributingFactors,
        analysisNotes: rootCauseData.analysisNotes,
        useFiveWhys: rootCauseData.useFiveWhys,
        useEightD: rootCauseData.useEightD,
        whySteps: rootCauseData.whySteps.map((s) => ({ id: s.id, stepNumber: s.stepNumber, question: s.question, answer: s.answer })),
        eightD: rootCauseData.eightD ? {
          d1Team: rootCauseData.eightD.d1Team, d2ProblemDescription: rootCauseData.eightD.d2ProblemDescription,
          d3InterimActions: rootCauseData.eightD.d3InterimActions, d4RootCause: rootCauseData.eightD.d4RootCause,
          d5PermanentActions: rootCauseData.eightD.d5PermanentActions, d6Implementation: rootCauseData.eightD.d6Implementation,
          d7Prevention: rootCauseData.eightD.d7Prevention, d8Closure: rootCauseData.eightD.d8Closure,
        } : null,
      } : null,
      actions: capa.actions.map((a): CapaActionDto => ({
        id: a.id, capaId: a.capaId, title: a.title, description: a.description, actionType: a.actionType,
        ownerId: a.ownerId, ownerName: fullName(a.owner), priority: a.priority, status: a.status,
        dueDate: a.dueDate?.toISOString() ?? null, completedAt: a.completedAt?.toISOString() ?? null, completionComment: a.completionComment,
        isOverdue: a.dueDate ? a.dueDate < now && a.status !== 'COMPLETED' && a.status !== 'VERIFIED' && a.status !== 'CANCELLED' : false,
        createdAt: a.createdAt.toISOString(), updatedAt: a.updatedAt.toISOString(),
      })),
      verification: capa.verification ? {
        verifiedByName: fullName(capa.verification.verifiedBy), result: capa.verification.result as VerificationResult,
        notes: capa.verification.notes, verifiedAt: capa.verification.verifiedAt.toISOString(),
      } : null,
      effectiveness: capa.effectiveness ? {
        reviewedByName: fullName(capa.effectiveness.reviewedBy), result: capa.effectiveness.result as EffectivenessResult,
        notes: capa.effectiveness.notes, reviewedAt: capa.effectiveness.reviewedAt.toISOString(),
      } : null,
    };
  }

  private async audit(actor: ActorContext, action: string, entityId: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.auditLog.record({ actorId: actor.actorId, ipAddress: actor.ipAddress, userAgent: actor.userAgent, action, entityType: 'capa', entityId, metadata: metadata ?? null });
  }
}

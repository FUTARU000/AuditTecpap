import { Injectable, NotFoundException } from '@nestjs/common';
import type { FindingDto } from '@tecpap/types';
import type { Prisma } from '@prisma/client';
import type { ActorContext } from '../../common/context/actor';
import { departmentScopeWhere } from '../../common/scoping/scope';
import type { DataScope } from '../../common/types/data-scope';
import { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateFindingDto, UpdateFindingDto } from './dto/findings.dto';

const INCLUDE = { responsible: { select: { firstName: true, lastName: true } } } satisfies Prisma.FindingInclude;

@Injectable()
export class FindingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly timeline: ActivityTimelineService,
  ) {}

  async listByAudit(auditId: string, scope: DataScope | undefined): Promise<FindingDto[]> {
    await this.assertAuditInScope(auditId, scope);
    const findings = await this.prisma.finding.findMany({ where: { auditId }, orderBy: { createdAt: 'desc' }, include: INCLUDE });
    return findings.map((finding) => this.toDto(finding));
  }

  async create(dto: CreateFindingDto & { auditId: string }, actor: ActorContext, scope: DataScope | undefined): Promise<FindingDto> {
    const audit = await this.assertAuditInScope(dto.auditId, scope);
    const finding = await this.prisma.finding.create({
      data: {
        auditId: dto.auditId, questionId: dto.questionId ?? null, title: dto.title, description: dto.description ?? null,
        severity: dto.severity, responsibleUserId: dto.responsibleUserId ?? null, dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        processId: dto.processId ?? audit.processId,
      },
      include: INCLUDE,
    });
    await this.timeline.record({ processId: audit.processId, eventType: 'finding.created', title: `Finding "${finding.title}" raised`, entityType: 'finding', entityId: finding.id, actorId: actor.actorId });
    await this.auditLog.record({ actorId: actor.actorId, ipAddress: actor.ipAddress, userAgent: actor.userAgent, action: 'finding.create', entityType: 'finding', entityId: finding.id, metadata: { auditId: dto.auditId, severity: dto.severity } });
    return this.toDto(finding);
  }

  async update(id: string, dto: UpdateFindingDto, actor: ActorContext, scope: DataScope | undefined): Promise<FindingDto> {
    const current = await this.prisma.finding.findUnique({ where: { id }, include: { audit: { select: { departmentId: true } } } });
    if (!current) throw new NotFoundException('Finding not found');
    if (scope && !scope.isGlobal && current.audit.departmentId !== scope.departmentId) throw new NotFoundException('Finding not found');
    const data: Prisma.FindingUncheckedUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.severity !== undefined) data.severity = dto.severity;
    if (dto.responsibleUserId !== undefined) data.responsibleUserId = dto.responsibleUserId;
    if (dto.dueDate !== undefined) data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.comments !== undefined) data.comments = dto.comments;
    const updated = await this.prisma.finding.update({ where: { id }, data, include: INCLUDE });
    return this.toDto(updated);
  }

  async remove(id: string, scope: DataScope | undefined): Promise<void> {
    const finding = await this.prisma.finding.findUnique({ where: { id }, include: { audit: { select: { departmentId: true } } } });
    if (!finding) throw new NotFoundException('Finding not found');
    if (scope && !scope.isGlobal && finding.audit.departmentId !== scope.departmentId) throw new NotFoundException('Finding not found');
    await this.prisma.finding.delete({ where: { id } });
  }

  /** Resolves the audit within `scope`, throwing NotFound if it doesn't exist or belongs to another department. */
  private async assertAuditInScope(auditId: string, scope: DataScope | undefined) {
    const audit = await this.prisma.audit.findFirst({ where: departmentScopeWhere(scope, { id: auditId }) as Prisma.AuditWhereInput });
    if (!audit) throw new NotFoundException('Audit not found');
    return audit;
  }

  private toDto(finding: {
    id: string; auditId: string; questionId: string | null; title: string; description: string | null;
    severity: string; responsibleUserId: string | null; dueDate: Date | null; status: string; processId: string | null; comments: string | null;
    createdAt: Date; updatedAt: Date; responsible: { firstName: string; lastName: string } | null;
  }): FindingDto {
    return {
      id: finding.id, auditId: finding.auditId, questionId: finding.questionId, title: finding.title, description: finding.description,
      severity: finding.severity as FindingDto['severity'], responsibleUserId: finding.responsibleUserId,
      responsibleName: finding.responsible ? `${finding.responsible.firstName} ${finding.responsible.lastName}` : null,
      dueDate: finding.dueDate ? finding.dueDate.toISOString() : null, status: finding.status, processId: finding.processId, comments: finding.comments,
      createdAt: finding.createdAt.toISOString(), updatedAt: finding.updatedAt.toISOString(),
    };
  }
}

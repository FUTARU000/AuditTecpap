import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { ActorContext } from '../../common/context/actor';
import { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { CapaService } from './capa.service';
import type { FindingDecisionDto, CreateCapaDto } from './dto/capa.dto';

@Injectable()
export class CapaFindingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly capaService: CapaService,
    private readonly auditLog: AuditLogService,
    private readonly timeline: ActivityTimelineService,
  ) {}

  async decide(findingId: string, dto: FindingDecisionDto, actor: ActorContext) {
    const finding = await this.prisma.finding.findUnique({ where: { id: findingId }, include: { audit: { select: { processId: true } } } });
    if (!finding) throw new NotFoundException('Finding not found');
    if (finding.capaDecision) throw new ConflictException(`CAPA decision already made: ${finding.capaDecision}`);

    const updated = await this.prisma.finding.update({
      where: { id: findingId },
      data: { capaDecision: dto.decision, capaDecisionById: actor.actorId, capaDecisionDate: new Date(), capaDecisionReason: dto.reason ?? null },
    });
    await this.timeline.record({ processId: finding.audit?.processId ?? finding.processId, eventType: 'finding.capa_decision', title: `Finding "${finding.title}": CAPA ${dto.decision}`, entityType: 'finding', entityId: findingId, actorId: actor.actorId });
    await this.auditLog.record({ actorId: actor.actorId, ipAddress: actor.ipAddress, userAgent: actor.userAgent, action: 'finding.capa_decision', entityType: 'finding', entityId: findingId, metadata: { decision: dto.decision, reason: dto.reason } });
    return { findingId, capaDecision: updated.capaDecision };
  }

  async createFromFinding(findingId: string, dto: Partial<CreateCapaDto>, actor: ActorContext) {
    const finding = await this.prisma.finding.findUnique({ where: { id: findingId }, include: { audit: { select: { id: true, departmentId: true, processId: true } } } });
    if (!finding) throw new NotFoundException('Finding not found');
    if (finding.capaDecision !== 'REQUIRED') throw new ConflictException('CAPA decision must be REQUIRED before creating a CAPA');

    // Prevent duplicate CAPA from same finding
    const existing = await this.prisma.capa.findFirst({ where: { findingId, deletedAt: null } });
    if (existing) throw new ConflictException(`A CAPA already exists for this finding: ${existing.referenceNumber}`);

    const capaDto: CreateCapaDto = {
      title: dto.title ?? `CAPA for: ${finding.title}`,
      description: dto.description ?? finding.description ?? undefined,
      sourceType: 'FINDING',
      sourceId: findingId,
      findingId,
      departmentId: dto.departmentId ?? finding.audit?.departmentId ?? '',
      processId: dto.processId ?? finding.processId ?? finding.audit?.processId ?? undefined,
      ownerId: dto.ownerId ?? undefined,
      priority: dto.priority,
      targetDate: dto.targetDate ?? undefined,
      effectivenessDueDate: dto.effectivenessDueDate ?? undefined,
    };
    return this.capaService.create(capaDto, actor);
  }
}

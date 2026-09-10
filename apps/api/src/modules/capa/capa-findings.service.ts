import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AUTO_CAPA_SEVERITIES } from '@tecpap/config';
import type { ActorContext } from '../../common/context/actor';
import type { DataScope } from '../../common/types/data-scope';
import { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { NotificationService } from '../productivity/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { CapaService } from './capa.service';
import type { FindingDecisionDto, CreateCapaDto } from './dto/capa.dto';

@Injectable()
export class CapaFindingsService {
  private readonly logger = new Logger(CapaFindingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly capaService: CapaService,
    private readonly auditLog: AuditLogService,
    private readonly timeline: ActivityTimelineService,
    private readonly notifications: NotificationService,
  ) {}

  async decide(findingId: string, dto: FindingDecisionDto, actor: ActorContext, scope: DataScope | undefined) {
    const finding = await this.assertFindingInScope(findingId, scope);
    if (finding.capaDecision) throw new ConflictException(`CAPA decision already made: ${finding.capaDecision}`);

    const updated = await this.prisma.finding.update({
      where: { id: findingId },
      data: { capaDecision: dto.decision, capaDecisionById: actor.actorId, capaDecisionDate: new Date(), capaDecisionReason: dto.reason ?? null },
    });
    await this.timeline.record({ processId: finding.audit?.processId ?? finding.processId, eventType: 'finding.capa_decision', title: `Finding "${finding.title}": CAPA ${dto.decision}`, entityType: 'finding', entityId: findingId, actorId: actor.actorId });
    await this.auditLog.record({ actorId: actor.actorId, ipAddress: actor.ipAddress, userAgent: actor.userAgent, action: 'finding.capa_decision', entityType: 'finding', entityId: findingId, metadata: { decision: dto.decision, reason: dto.reason } });
    return { findingId, capaDecision: updated.capaDecision };
  }

  async createFromFinding(findingId: string, dto: Partial<CreateCapaDto>, actor: ActorContext, scope: DataScope | undefined) {
    const finding = await this.assertFindingInScope(findingId, scope);
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
      // TECPAP rule: a CAPA created from a finding always inherits the
      // finding's own department. The source finding's department is
      // authoritative — a caller-supplied departmentId is never used here,
      // so a CAPA can never be redirected into a different department than
      // the finding it was sourced from.
      departmentId: finding.audit.departmentId,
      processId: dto.processId ?? finding.processId ?? finding.audit.processId ?? undefined,
      ownerId: dto.ownerId ?? undefined,
      priority: dto.priority,
      targetDate: dto.targetDate ?? undefined,
      effectivenessDueDate: dto.effectivenessDueDate ?? undefined,
    };
    return this.capaService.create(capaDto, actor, undefined, scope);
  }

  /**
   * Phase 7.7 — TECPAP workflow: auto-create a CAPA when a finding with a
   * non-conformity severity (MAJOR_NC, MINOR_NC) is created. The CAPA starts
   * at ASSIGNED status and is assigned to the process pilot (resolved via
   * ProcessAssignment → audit.auditorId → finding.responsibleUserId fallback).
   * Notifies the assigned pilot.
   */
  async autoCreateForFinding(findingId: string, actor: ActorContext): Promise<{ capaId: string; referenceNumber: string } | null> {
    const finding = await this.prisma.finding.findUnique({
      where: { id: findingId },
      include: { audit: { select: { id: true, departmentId: true, processId: true, auditorId: true, createdById: true } }, responsible: { select: { id: true } } },
    });
    if (!finding) return null;

    // Only auto-create for NC severities
    if (!AUTO_CAPA_SEVERITIES.includes(finding.severity as typeof AUTO_CAPA_SEVERITIES[number])) return null;

    // Idempotency: skip if decision already made or CAPA already exists
    if (finding.capaDecision) return null;
    const existing = await this.prisma.capa.findFirst({ where: { findingId, deletedAt: null } });
    if (existing) return null;

    // Resolve the pilot owner
    const pilotId = await this.resolvePilotOwner(finding);

    // Set the finding decision automatically
    await this.prisma.finding.update({
      where: { id: findingId },
      data: { capaDecision: 'REQUIRED', capaDecisionById: actor.actorId, capaDecisionDate: new Date(), capaDecisionReason: 'Auto-generated for non-conformity' },
    });

    const departmentId = finding.audit?.departmentId ?? '';
    const processId = finding.processId ?? finding.audit?.processId ?? null;

    const capaDto: CreateCapaDto = {
      title: `CAPA for: ${finding.title}`,
      description: finding.description ?? undefined,
      sourceType: 'FINDING',
      sourceId: findingId,
      findingId,
      departmentId,
      processId: processId ?? undefined,
      ownerId: pilotId ?? undefined,
      priority: finding.severity === 'MAJOR_NC' ? 'HIGH' : 'MEDIUM',
    };

    try {
      const capa = await this.capaService.create(capaDto, actor, 'ASSIGNED');
      await this.timeline.record({ processId, eventType: 'capa.auto_created', title: `CAPA ${capa.referenceNumber} auto-generated from finding`, entityType: 'capa', entityId: capa.id, actorId: actor.actorId });

      // Notify the assigned pilot
      if (pilotId) {
        await this.notifications.emit({
          userId: pilotId,
          type: 'CAPA_ASSIGNED',
          category: 'capa',
          severity: finding.severity === 'MAJOR_NC' ? 'WARNING' : 'INFO',
          params: { reference: capa.referenceNumber, findingTitle: finding.title },
          entityType: 'capa',
          entityId: capa.id,
          actionUrl: `/capas/${capa.id}`,
        });
      }

      this.logger.log(`Auto-created CAPA ${capa.referenceNumber} for finding ${findingId} (severity: ${finding.severity})`);
      return { capaId: capa.id, referenceNumber: capa.referenceNumber };
    } catch (err) {
      this.logger.error(`Auto-CAPA creation failed for finding ${findingId}: ${(err as Error).message}`);
      return null;
    }
  }

  /** Resolves the finding (with its parent audit) within `scope`, throwing NotFound if it doesn't exist or belongs to another department. */
  private async assertFindingInScope(findingId: string, scope: DataScope | undefined) {
    const finding = await this.prisma.finding.findUnique({
      where: { id: findingId },
      include: { audit: { select: { id: true, departmentId: true, processId: true } } },
    });
    if (!finding) throw new NotFoundException('Finding not found');
    if (scope && !scope.isGlobal && finding.audit.departmentId !== scope.departmentId) {
      throw new NotFoundException('Finding not found');
    }
    return finding;
  }

  /** Resolve the process pilot for a finding: ProcessAssignment(OPERATOR) → responsible → auditor → audit creator. */
  private async resolvePilotOwner(finding: { processId: string | null; audit: { auditorId: string | null; createdById: string | null } | null; responsibleUserId: string | null; responsible?: { id: string } | null }): Promise<string | null> {
    // Try ProcessAssignment with role=OPERATOR
    if (finding.processId) {
      const assignment = await this.prisma.processAssignment.findFirst({
        where: { processId: finding.processId, role: 'OPERATOR' },
        select: { userId: true },
      });
      if (assignment) return assignment.userId;
    }
    // Fallback: finding responsible user
    if (finding.responsible?.id) return finding.responsible.id;
    if (finding.responsibleUserId) return finding.responsibleUserId;
    // Fallback: audit auditor
    if (finding.audit?.auditorId) return finding.audit.auditorId;
    // Fallback: audit creator (the Audit Manager who created the audit)
    if (finding.audit?.createdById) return finding.audit.createdById;
    return null;
  }
}

import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CAPA_STAGE_MAP, CAPA_TRANSITIONS, normalizeName, type CapaStatus } from '@tecpap/config';
import type {
  CapaActionDto,
  CapaDetailDto,
  CapaDto,
  EffectivenessResult,
  PaginatedResult,
  VerificationResult,
} from '@tecpap/types';
import type { Prisma } from '@prisma/client';
import type { ActorContext } from '../../common/context/actor';
import { paginated, parsePagination, parseSort } from '../../common/pagination/pagination';
import { departmentScopeWhere } from '../../common/scoping/scope';
import type { DataScope } from '../../common/types/data-scope';
import { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { NotificationService } from '../productivity/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { latestActionVerificationStatus } from './capa-action-verification.util';
import type { CreateCapaDto, ListCapasQuery, UpdateCapaDto } from './dto/capa.dto';

const DETAIL_INCLUDE = {
  department: { select: { name: true } },
  process: { select: { name: true } },
  owner: { select: { firstName: true, lastName: true } },
  createdBy: { select: { firstName: true, lastName: true } },
  closedBy: { select: { firstName: true, lastName: true } },
  finding: { select: { id: true, title: true } },
  rootCause: { include: { whySteps: { orderBy: { stepNumber: 'asc' } }, eightD: true } },
  actions: {
    include: {
      owner: { select: { firstName: true, lastName: true } },
      verifications: {
        include: { verifiedBy: { select: { firstName: true, lastName: true } } },
        orderBy: { verifiedAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
  // Phase 3: every attempt is preserved — ordered oldest-first so "Attempt 1"
  // is the first verification ever recorded for this CAPA.
  verifications: {
    include: { verifiedBy: { select: { firstName: true, lastName: true } } },
    orderBy: { verifiedAt: 'asc' },
  },
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
  verifications: { select: { id: true } },
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
    private readonly notifications: NotificationService,
  ) {}

  async list(
    query: ListCapasQuery,
    scope: DataScope | undefined,
  ): Promise<PaginatedResult<CapaDto>> {
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
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { referenceNumber: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.overdue === 'true'
        ? { targetDate: { lt: now }, status: { notIn: ['CLOSED', 'CANCELLED'] } }
        : {}),
    };
    const where = departmentScopeWhere(scope, base) as Prisma.CapaWhereInput;
    const [rows, total] = await Promise.all([
      this.prisma.capa.findMany({
        where,
        skip,
        take,
        orderBy: parseSort(query.sort, ['referenceNumber', 'title', 'createdAt', 'status'], {
          createdAt: 'desc',
        }),
        include: LIST_INCLUDE,
      }),
      this.prisma.capa.count({ where }),
    ]);
    return paginated(
      rows.map((r) => this.toListDto(r, now)),
      total,
      page,
      pageSize,
    );
  }

  async findOne(id: string, scope: DataScope | undefined): Promise<CapaDetailDto> {
    const capa = await this.prisma.capa.findFirst({
      where: { id, ...departmentScopeWhere(scope) },
      include: DETAIL_INCLUDE,
    });
    if (!capa) throw new NotFoundException('CAPA not found');
    return this.toDetailDto(capa, new Date());
  }

  async create(
    dto: CreateCapaDto,
    actor: ActorContext,
    initialStatus?: CapaStatus,
    scope?: DataScope,
  ): Promise<CapaDetailDto> {
    // Department-scoped users (Pilots) may only create a CAPA in their own
    // department — the target departmentId must match their DataScope.
    // Global scope (Admin/Audit Manager) and trusted internal callers that
    // don't pass a scope (e.g. auto-CAPA creation from a finding) are unaffected.
    if (scope && !scope.isGlobal && dto.departmentId !== scope.departmentId) {
      throw new ForbiddenException('Cannot create a CAPA outside your department');
    }
    // Business rule: CAPA target date cannot be in the past
    if (dto.targetDate) {
      const target = new Date(dto.targetDate);
      if (isNaN(target.getTime())) throw new ConflictException('Invalid target date format');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (target < today) throw new ConflictException('CAPA target date cannot be in the past');
    }
    await this.assertUniqueTitle(dto.title);
    const referenceNumber = await this.generateReference();
    const capa = await this.prisma.capa.create({
      data: {
        referenceNumber,
        title: dto.title,
        normalizedTitle: normalizeName(dto.title),
        description: dto.description ?? null,
        sourceType: dto.sourceType ?? 'MANUAL',
        sourceId: dto.sourceId ?? null,
        findingId: dto.findingId ?? null,
        departmentId: dto.departmentId,
        processId: dto.processId ?? null,
        ownerId: dto.ownerId ?? null,
        createdById: actor.actorId ?? '',
        priority: dto.priority ?? 'MEDIUM',
        status: (initialStatus ?? 'DRAFT') as Prisma.CapaUncheckedCreateInput['status'],
        targetDate: dto.targetDate ? new Date(dto.targetDate) : null,
        effectivenessDueDate: dto.effectivenessDueDate ? new Date(dto.effectivenessDueDate) : null,
        rootCause: { create: {} },
      },
      include: DETAIL_INCLUDE,
    });
    await this.timeline.record({
      processId: dto.processId,
      eventType: 'capa.created',
      title: `${referenceNumber} created`,
      entityType: 'capa',
      entityId: capa.id,
      actorId: actor.actorId,
    });
    await this.audit(actor, 'capa.create', capa.id, {
      referenceNumber,
      initialStatus: initialStatus ?? 'DRAFT',
    });
    return this.toDetailDto(capa, new Date());
  }

  async update(id: string, dto: UpdateCapaDto, actor: ActorContext): Promise<CapaDetailDto> {
    const current = await this.prisma.capa.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundException('CAPA not found');
    if (dto.title !== undefined) await this.assertUniqueTitle(dto.title, id);
    const data: Prisma.CapaUncheckedUpdateInput = {};
    if (dto.title !== undefined) {
      data.title = dto.title;
      data.normalizedTitle = normalizeName(dto.title);
    }
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.ownerId !== undefined) data.ownerId = dto.ownerId;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.targetDate !== undefined)
      data.targetDate = dto.targetDate ? new Date(dto.targetDate) : null;
    if (dto.effectivenessDueDate !== undefined)
      data.effectivenessDueDate = dto.effectivenessDueDate
        ? new Date(dto.effectivenessDueDate)
        : null;
    const updated = await this.prisma.capa.update({ where: { id }, data, include: DETAIL_INCLUDE });
    await this.audit(actor, 'capa.update', id);
    return this.toDetailDto(updated, new Date());
  }

  async transition(id: string, target: CapaStatus, actor: ActorContext): Promise<CapaDetailDto> {
    const current = await this.prisma.capa.findFirst({
      where: { id, deletedAt: null },
      include: DETAIL_INCLUDE,
    });
    if (!current) throw new NotFoundException('CAPA not found');
    const allowed = CAPA_TRANSITIONS[current.status] ?? [];
    if (!allowed.includes(target))
      throw new ConflictException(`Cannot transition CAPA from ${current.status} to ${target}`);

    // Enforce: cannot go to PENDING_VERIFICATION if actions are incomplete
    if (target === 'PENDING_VERIFICATION') {
      const incomplete = current.actions.filter(
        (a) => a.status !== 'COMPLETED' && a.status !== 'VERIFIED' && a.status !== 'CANCELLED',
      );
      if (incomplete.length > 0)
        throw new ConflictException(`${incomplete.length} action(s) are not completed`);
    }
    // Enforce: cannot close without verification + effectiveness
    if (target === 'CLOSED') {
      const latest = this.latestVerification(current.verifications);
      if (!latest || latest.result !== 'PASSED')
        throw new ConflictException('CAPA must pass verification before closure');
      if (!current.effectiveness || current.effectiveness.result !== 'EFFECTIVE')
        throw new ConflictException(
          'CAPA must have an effective effectiveness review before closure',
        );
    }

    const now = new Date();
    const data: Prisma.CapaUncheckedUpdateInput = { status: target };
    if (target === 'IN_PROGRESS' && !current.openedAt) data.openedAt = now;
    if (target === 'PENDING_VERIFICATION') data.submittedAt = now;
    if (target === 'CLOSED') data.closedAt = now;

    const updated = await this.prisma.capa.update({ where: { id }, data, include: DETAIL_INCLUDE });
    await this.timeline.record({
      processId: current.processId,
      eventType: `capa.${target.toLowerCase()}`,
      title: `${current.referenceNumber} → ${target}`,
      entityType: 'capa',
      entityId: id,
      actorId: actor.actorId,
    });
    await this.audit(actor, 'capa.transition', id, { from: current.status, to: target });
    return this.toDetailDto(updated, now);
  }

  /**
   * Phase 3 — audit trail: every call CREATES a new, immutable
   * CapaVerification row. Earlier attempts (e.g. a prior FAILED) are never
   * updated or overwritten, so the full verification history survives an
   * unlimited number of FAILED → RETURNED → rework → resubmit cycles.
   *
   * Logical consistency with individual action verification: the CAPA cannot
   * become VALIDATED while any action's latest individual verification is
   * FAILED — that action must be reworked and re-verified first. Actions
   * never individually reviewed (NOT_VERIFIED) do not block this, so CAPAs
   * that never use per-action verification keep working exactly as before.
   */
  async verify(
    id: string,
    result: 'PASSED' | 'FAILED',
    notes: string | null,
    actor: ActorContext,
  ): Promise<CapaDetailDto> {
    const capa = await this.prisma.capa.findFirst({
      where: { id, deletedAt: null },
      include: { actions: { include: { verifications: { orderBy: { verifiedAt: 'asc' } } } } },
    });
    if (!capa) throw new NotFoundException('CAPA not found');
    if (capa.status !== 'PENDING_VERIFICATION')
      throw new ConflictException('CAPA must be in PENDING_VERIFICATION to verify');

    if (result === 'PASSED') {
      const failedActions = capa.actions.filter(
        (a) => latestActionVerificationStatus(a.verifications) === 'FAILED',
      );
      if (failedActions.length > 0) {
        throw new ConflictException(
          `Cannot validate: ${failedActions.length} action(s) failed individual verification and must be reworked (${failedActions.map((a) => a.title).join(', ')})`,
        );
      }
    }

    const verification = await this.prisma.capaVerification.create({
      data: { capaId: id, verifiedById: actor.actorId!, result, notes },
    });
    // Phase 7.7: TECPAP workflow — PASSED → VALIDATED (new), FAILED → RETURNED (new)
    // Legacy CAPAs that came through PENDING_EFFECTIVENESS keep that path.
    const nextStatus: CapaStatus = result === 'PASSED' ? 'VALIDATED' : 'RETURNED';
    const updated = await this.prisma.capa.update({
      where: { id },
      data: { status: nextStatus, verifiedAt: result === 'PASSED' ? new Date() : null },
      include: DETAIL_INCLUDE,
    });
    await this.timeline.record({
      processId: capa.processId,
      eventType: `capa.verification_${result.toLowerCase()}`,
      title: `${capa.referenceNumber} verification ${result} → ${nextStatus}`,
      entityType: 'capa',
      entityId: id,
      actorId: actor.actorId,
    });
    await this.audit(actor, `capa.verify_${result.toLowerCase()}`, id, { notes, nextStatus });

    // Phase 4 — notify the responsible Pilot of the verification outcome. Only
    // ever fires AFTER the verification row + status transition above have
    // both succeeded (sequential await; nothing here runs if either threw),
    // and is itself best-effort: a notification/email failure must never fail
    // the verification call, matching every other emit() call site in the app.
    await this.notifyVerificationResult(capa, verification.id, result, notes, actor);

    return this.toDetailDto(updated, new Date());
  }

  /**
   * Recipient = the CAPA's existing owner, falling back to its creator (the
   * exact fallback already used for CAPA reminders in reminder.service.ts) —
   * never a new ownership model, never a department-wide broadcast. Skips the
   * acting Audit Manager if they happen to be that same user (no self-notify),
   * matching the guard already used in DocumentsService.changeStatus().
   *
   * `entityId` is the verification attempt's own id (not the CAPA id) so that
   * NotificationService.emit()'s 24h per-(type, entityId, userId) dedup can
   * never collapse two distinct verification attempts on the same CAPA into
   * one notification — each attempt is a genuinely new event.
   */
  private async notifyVerificationResult(
    capa: {
      id: string;
      referenceNumber: string;
      title: string;
      departmentId: string;
      ownerId: string | null;
      createdById: string;
    },
    verificationId: string,
    result: 'PASSED' | 'FAILED',
    notes: string | null,
    actor: ActorContext,
  ): Promise<void> {
    const recipientId = capa.ownerId ?? capa.createdById;
    if (recipientId === actor.actorId) return;

    const passed = result === 'PASSED';
    await this.notifications
      .emit({
        userId: recipientId,
        type: passed ? 'CAPA_VALIDATED' : 'CAPA_RETURNED',
        category: 'capa',
        severity: passed ? 'SUCCESS' : 'WARNING',
        // Phase 5: params drive the shared EN/FR template (packages/config) —
        // notes is an optional generic suffix the template renderer appends.
        params: { reference: capa.referenceNumber, title: capa.title, notes: notes ?? undefined },
        entityType: 'capa_verification',
        entityId: verificationId,
        actionUrl: `/capas/${capa.id}`,
        departmentId: capa.departmentId,
      })
      .catch(() => undefined);
  }

  /** Phase 7.7 — Pilot submits corrective action work for Audit Manager verification. */
  async submit(id: string, actor: ActorContext): Promise<CapaDetailDto> {
    const current = await this.prisma.capa.findFirst({
      where: { id, deletedAt: null },
      include: DETAIL_INCLUDE,
    });
    if (!current) throw new NotFoundException('CAPA not found');
    if (!['ASSIGNED', 'IN_PROGRESS', 'EVIDENCE_UPLOADED'].includes(current.status)) {
      throw new ConflictException(
        `CAPA must be ASSIGNED, IN_PROGRESS or EVIDENCE_UPLOADED to submit (current: ${current.status})`,
      );
    }
    const incomplete = current.actions.filter(
      (a) => a.status !== 'COMPLETED' && a.status !== 'VERIFIED' && a.status !== 'CANCELLED',
    );
    if (incomplete.length > 0)
      throw new ConflictException(`${incomplete.length} action(s) are not completed`);
    const updated = await this.prisma.capa.update({
      where: { id },
      data: { status: 'PENDING_VERIFICATION' as CapaStatus, submittedAt: new Date() },
      include: DETAIL_INCLUDE,
    });
    await this.timeline.record({
      processId: current.processId,
      eventType: 'capa.submitted',
      title: `${current.referenceNumber} submitted for verification`,
      entityType: 'capa',
      entityId: id,
      actorId: actor.actorId,
    });
    await this.audit(actor, 'capa.submit', id);
    return this.toDetailDto(updated, new Date());
  }

  /** Phase 7.7 — Pilot responds to a RETURNED CAPA (rework) and moves back to IN_PROGRESS. */
  async rework(id: string, actor: ActorContext): Promise<CapaDetailDto> {
    const current = await this.prisma.capa.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundException('CAPA not found');
    if (current.status !== 'RETURNED')
      throw new ConflictException('CAPA must be RETURNED to start rework');
    const updated = await this.prisma.capa.update({
      where: { id },
      data: { status: 'IN_PROGRESS' as CapaStatus },
      include: DETAIL_INCLUDE,
    });
    await this.timeline.record({
      processId: current.processId,
      eventType: 'capa.rework_started',
      title: `${current.referenceNumber} rework started`,
      entityType: 'capa',
      entityId: id,
      actorId: actor.actorId,
    });
    await this.audit(actor, 'capa.rework', id);
    return this.toDetailDto(updated, new Date());
  }

  async reviewEffectiveness(
    id: string,
    result: 'EFFECTIVE' | 'PARTIALLY_EFFECTIVE' | 'INEFFECTIVE',
    notes: string | null,
    actor: ActorContext,
  ): Promise<CapaDetailDto> {
    const capa = await this.prisma.capa.findFirst({ where: { id, deletedAt: null } });
    if (!capa) throw new NotFoundException('CAPA not found');
    if (capa.status !== 'PENDING_EFFECTIVENESS')
      throw new ConflictException('CAPA must be in PENDING_EFFECTIVENESS to review');

    await this.prisma.capaEffectivenessReview.upsert({
      where: { capaId: id },
      create: { capaId: id, reviewedById: actor.actorId!, result, notes },
      update: { reviewedById: actor.actorId!, result, notes, reviewedAt: new Date() },
    });
    // Only EFFECTIVE permits closure path; others reopen
    const nextStatus = result === 'EFFECTIVE' ? 'PENDING_EFFECTIVENESS' : 'IN_PROGRESS';
    const updated = await this.prisma.capa.update({
      where: { id },
      data: { status: nextStatus, effectivenessReviewedAt: new Date() },
      include: DETAIL_INCLUDE,
    });
    await this.timeline.record({
      processId: capa.processId,
      eventType: `capa.effectiveness_${result.toLowerCase()}`,
      title: `${capa.referenceNumber} effectiveness: ${result}`,
      entityType: 'capa',
      entityId: id,
      actorId: actor.actorId,
    });
    await this.audit(actor, `capa.effectiveness_${result.toLowerCase()}`, id, { notes });
    return this.toDetailDto(updated, new Date());
  }

  async close(
    id: string,
    closureComment: string | null,
    actor: ActorContext,
  ): Promise<CapaDetailDto> {
    return this.transitionWithChecks(id, 'CLOSED', actor, {
      closureComment: closureComment ?? undefined,
    });
  }

  private async transitionWithChecks(
    id: string,
    target: CapaStatus,
    actor: ActorContext,
    extra?: { closureComment?: string },
  ): Promise<CapaDetailDto> {
    const current = await this.prisma.capa.findFirst({
      where: { id, deletedAt: null },
      include: DETAIL_INCLUDE,
    });
    if (!current) throw new NotFoundException('CAPA not found');
    if (!(CAPA_TRANSITIONS[current.status] ?? []).includes(target))
      throw new ConflictException(`Cannot transition CAPA from ${current.status} to ${target}`);
    if (target === 'CLOSED') {
      const latest = this.latestVerification(current.verifications);
      if (!latest || latest.result !== 'PASSED')
        throw new ConflictException('Verification must pass before closure');
      // TECPAP path: VALIDATED status means verification passed and effectiveness is implied.
      // Legacy path: PENDING_EFFECTIVENESS requires an explicit EFFECTIVE effectiveness review.
      if (
        current.status === 'PENDING_EFFECTIVENESS' &&
        (!current.effectiveness || current.effectiveness.result !== 'EFFECTIVE')
      ) {
        throw new ConflictException('Effectiveness must be EFFECTIVE before closure');
      }
    }
    const now = new Date();
    const updated = await this.prisma.capa.update({
      where: { id },
      data: {
        status: target,
        closedAt: target === 'CLOSED' ? now : null,
        closedById: target === 'CLOSED' ? actor.actorId : undefined,
        closureComment: extra?.closureComment ?? undefined,
      } as Prisma.CapaUncheckedUpdateInput,
      include: DETAIL_INCLUDE,
    });
    await this.timeline.record({
      processId: current.processId,
      eventType: `capa.${target.toLowerCase()}`,
      title: `${current.referenceNumber} → ${target}`,
      entityType: 'capa',
      entityId: id,
      actorId: actor.actorId,
    });
    await this.audit(actor, 'capa.transition', id, { from: current.status, to: target });
    return this.toDetailDto(updated, now);
  }

  async updateRootCause(
    id: string,
    dto: Partial<{
      problemStatement: string | null;
      immediateCause: string | null;
      rootCause: string | null;
      contributingFactors: string | null;
      analysisNotes: string | null;
      useFiveWhys: boolean;
      useEightD: boolean;
    }>,
    actor: ActorContext,
  ): Promise<CapaDetailDto> {
    const capa = await this.prisma.capa.findFirst({ where: { id, deletedAt: null } });
    if (!capa) throw new NotFoundException('CAPA not found');
    await this.prisma.capaRootCauseAnalysis.upsert({
      where: { capaId: id },
      create: { capaId: id, ...dto },
      update: { ...dto },
    });
    const updated = await this.prisma.capa.findUnique({ where: { id }, include: DETAIL_INCLUDE });
    await this.timeline.record({
      processId: capa.processId,
      eventType: 'capa.root_cause_updated',
      title: `${capa.referenceNumber} root cause updated`,
      entityType: 'capa',
      entityId: id,
      actorId: actor.actorId,
    });
    return this.toDetailDto(updated!, new Date());
  }

  async addWhyStep(
    id: string,
    question: string,
    answer: string | null,
    actor: ActorContext,
  ): Promise<CapaDetailDto> {
    const capa = await this.prisma.capa.findFirst({
      where: { id, deletedAt: null },
      include: { rootCause: { include: { whySteps: true } } },
    });
    if (!capa || !capa.rootCause) throw new NotFoundException('CAPA or root cause not found');
    const nextStep = (capa.rootCause.whySteps.at(-1)?.stepNumber ?? 0) + 1;
    await this.prisma.capaWhyStep.create({
      data: { analysisId: capa.rootCause.id, stepNumber: nextStep, question, answer },
    });
    return this.toDetailDto(
      (await this.prisma.capa.findUnique({ where: { id }, include: DETAIL_INCLUDE }))!,
      new Date(),
    );
  }

  async deleteWhyStep(id: string, stepId: string): Promise<CapaDetailDto> {
    await this.prisma.capaWhyStep.delete({ where: { id: stepId } });
    return this.toDetailDto(
      (await this.prisma.capa.findUnique({ where: { id }, include: DETAIL_INCLUDE }))!,
      new Date(),
    );
  }

  async updateEightD(
    id: string,
    dto: Record<string, string | null>,
    actor: ActorContext,
  ): Promise<CapaDetailDto> {
    const capa = await this.prisma.capa.findFirst({
      where: { id, deletedAt: null },
      include: { rootCause: { include: { eightD: true } } },
    });
    if (!capa || !capa.rootCause) throw new NotFoundException('CAPA or root cause not found');
    await this.prisma.capaEightD.upsert({
      where: { analysisId: capa.rootCause.id },
      create: { analysisId: capa.rootCause.id, ...dto },
      update: { ...dto },
    });
    return this.toDetailDto(
      (await this.prisma.capa.findUnique({ where: { id }, include: DETAIL_INCLUDE }))!,
      new Date(),
    );
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

  /** Most recent verification attempt — `verifications` is fetched ordered oldest-first. */
  private latestVerification<T extends { result: VerificationResult }>(
    verifications: T[],
  ): T | undefined {
    return verifications.at(-1);
  }

  /** Rejects a title already used by another non-deleted CAPA (case-insensitive, whitespace-normalized). */
  private async assertUniqueTitle(title: string, excludeId?: string): Promise<void> {
    const existing = await this.prisma.capa.findFirst({
      where: {
        normalizedTitle: normalizeName(title),
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (existing)
      throw new ConflictException({
        code: 'CAPA_DUPLICATE_NAME',
        message: 'A CAPA with this name already exists.',
      });
  }

  private async generateReference(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.capa.count({
      where: { referenceNumber: { startsWith: `CAPA-${year}-` } },
    });
    return `CAPA-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  private toListDto(
    capa: Prisma.CapaGetPayload<{ include: typeof LIST_INCLUDE }>,
    now: Date,
  ): CapaDto {
    return {
      id: capa.id,
      referenceNumber: capa.referenceNumber,
      title: capa.title,
      description: capa.description,
      sourceType: capa.sourceType,
      sourceId: capa.sourceId,
      findingId: capa.findingId,
      findingTitle: capa.finding?.title ?? null,
      departmentId: capa.departmentId,
      departmentName: capa.department?.name ?? null,
      processId: capa.processId,
      processName: capa.process?.name ?? null,
      ownerId: capa.ownerId,
      ownerName: fullName(capa.owner),
      createdById: capa.createdById,
      createdByName: fullName(capa.createdBy),
      priority: capa.priority,
      status: capa.status,
      targetDate: capa.targetDate?.toISOString() ?? null,
      openedAt: capa.openedAt?.toISOString() ?? null,
      submittedAt: capa.submittedAt?.toISOString() ?? null,
      verifiedAt: capa.verifiedAt?.toISOString() ?? null,
      effectivenessDueDate: capa.effectivenessDueDate?.toISOString() ?? null,
      effectivenessReviewedAt: capa.effectivenessReviewedAt?.toISOString() ?? null,
      closedAt: capa.closedAt?.toISOString() ?? null,
      closedById: capa.closedById,
      closureComment: capa.closureComment,
      isOverdue: capa.targetDate
        ? capa.targetDate < now && capa.status !== 'CLOSED' && capa.status !== 'CANCELLED'
        : false,
      actionCount: capa._count.actions,
      completedActionCount: 0,
      hasRootCause: !!capa.rootCause?.id,
      hasVerification: capa.verifications.length > 0,
      hasEffectivenessReview: !!capa.effectiveness?.id,
      stage: CAPA_STAGE_MAP[capa.status as CapaStatus] ?? null,
      createdAt: capa.createdAt.toISOString(),
      updatedAt: capa.updatedAt.toISOString(),
    };
  }

  private toDetailDto(
    capa: Prisma.CapaGetPayload<{ include: typeof DETAIL_INCLUDE }>,
    now: Date,
  ): CapaDetailDto {
    const completedActions = capa.actions.filter(
      (a) => a.status === 'COMPLETED' || a.status === 'VERIFIED',
    ).length;
    const base: CapaDto = {
      ...this.toListDto(
        {
          ...capa,
          _count: { actions: capa.actions.length, findings: 0 },
        } as Prisma.CapaGetPayload<{ include: typeof LIST_INCLUDE }>,
        now,
      ),
      completedActionCount: completedActions,
    };
    const rootCauseData = capa.rootCause;
    return {
      ...base,
      rootCause: rootCauseData
        ? {
            problemStatement: rootCauseData.problemStatement,
            immediateCause: rootCauseData.immediateCause,
            rootCause: rootCauseData.rootCause,
            contributingFactors: rootCauseData.contributingFactors,
            analysisNotes: rootCauseData.analysisNotes,
            useFiveWhys: rootCauseData.useFiveWhys,
            useEightD: rootCauseData.useEightD,
            whySteps: rootCauseData.whySteps.map((s) => ({
              id: s.id,
              stepNumber: s.stepNumber,
              question: s.question,
              answer: s.answer,
            })),
            eightD: rootCauseData.eightD
              ? {
                  d1Team: rootCauseData.eightD.d1Team,
                  d2ProblemDescription: rootCauseData.eightD.d2ProblemDescription,
                  d3InterimActions: rootCauseData.eightD.d3InterimActions,
                  d4RootCause: rootCauseData.eightD.d4RootCause,
                  d5PermanentActions: rootCauseData.eightD.d5PermanentActions,
                  d6Implementation: rootCauseData.eightD.d6Implementation,
                  d7Prevention: rootCauseData.eightD.d7Prevention,
                  d8Closure: rootCauseData.eightD.d8Closure,
                }
              : null,
          }
        : null,
      actions: capa.actions.map((a): CapaActionDto => ({
        id: a.id,
        capaId: a.capaId,
        title: a.title,
        description: a.description,
        actionType: a.actionType,
        ownerId: a.ownerId,
        ownerName: fullName(a.owner),
        priority: a.priority,
        status: a.status,
        dueDate: a.dueDate?.toISOString() ?? null,
        completedAt: a.completedAt?.toISOString() ?? null,
        completionComment: a.completionComment,
        isOverdue: a.dueDate
          ? a.dueDate < now &&
            a.status !== 'COMPLETED' &&
            a.status !== 'VERIFIED' &&
            a.status !== 'CANCELLED'
          : false,
        verificationStatus: latestActionVerificationStatus(a.verifications),
        verifications: a.verifications.map((v) => ({
          id: v.id,
          actionId: v.actionId,
          verifiedById: v.verifiedById,
          verifiedByName: fullName(v.verifiedBy),
          result: v.result as VerificationResult,
          notes: v.notes,
          verifiedAt: v.verifiedAt.toISOString(),
        })),
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
      })),
      // Phase 3: full immutable history, oldest attempt first ("Attempt 1" ... "Attempt N").
      verifications: capa.verifications.map((v) => ({
        id: v.id,
        verifiedById: v.verifiedById,
        verifiedByName: fullName(v.verifiedBy),
        result: v.result as VerificationResult,
        notes: v.notes,
        verifiedAt: v.verifiedAt.toISOString(),
      })),
      effectiveness: capa.effectiveness
        ? {
            reviewedByName: fullName(capa.effectiveness.reviewedBy),
            result: capa.effectiveness.result as EffectivenessResult,
            notes: capa.effectiveness.notes,
            reviewedAt: capa.effectiveness.reviewedAt.toISOString(),
          }
        : null,
    };
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
      entityType: 'capa',
      entityId,
      metadata: metadata ?? null,
    });
  }
}

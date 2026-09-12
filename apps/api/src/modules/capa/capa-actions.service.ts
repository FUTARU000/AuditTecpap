import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CapaActionDto, CapaActionEvidenceDto } from '@tecpap/types';
import type { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import type { ActorContext } from '../../common/context/actor';
import { departmentScopeWhere } from '../../common/scoping/scope';
import type { DataScope } from '../../common/types/data-scope';
import { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { NotificationService } from '../productivity/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { latestActionVerificationStatus } from './capa-action-verification.util';
import type { CreateActionDto, UpdateActionDto, VerifyActionDto } from './dto/capa.dto';

const ACTION_INCLUDE = {
  owner: { select: { firstName: true, lastName: true } },
  _count: { select: { evidence: true } },
  verifications: {
    include: { verifiedBy: { select: { firstName: true, lastName: true } } },
    orderBy: { verifiedAt: 'asc' as const },
  },
} satisfies Prisma.CapaActionInclude;

function fullName(user: { firstName: string; lastName: string } | null): string | null {
  return user ? `${user.firstName} ${user.lastName}` : null;
}

@Injectable()
export class CapaActionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly auditLog: AuditLogService,
    private readonly timeline: ActivityTimelineService,
    private readonly notifications: NotificationService,
  ) {}

  async list(capaId: string, scope: DataScope | undefined): Promise<CapaActionDto[]> {
    await this.assertCapaInScope(capaId, scope);
    const actions = await this.prisma.capaAction.findMany({
      where: { capaId },
      orderBy: { createdAt: 'asc' },
      include: ACTION_INCLUDE,
    });
    const now = new Date();
    return actions.map((a) => this.toDto(a, now));
  }

  async create(
    capaId: string,
    dto: CreateActionDto,
    actor: ActorContext,
    scope: DataScope | undefined,
  ): Promise<CapaActionDto> {
    const capa = await this.assertCapaInScope(capaId, scope);
    // Business rule: action due date cannot be in the past
    if (dto.dueDate) {
      const due = new Date(dto.dueDate);
      if (isNaN(due.getTime())) throw new ConflictException('Invalid due date format');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (due < today) throw new ConflictException('Action due date cannot be in the past');
    }
    const action = await this.prisma.capaAction.create({
      data: {
        capaId,
        title: dto.title,
        description: dto.description ?? null,
        actionType: dto.actionType ?? 'CORRECTIVE',
        ownerId: dto.ownerId ?? null,
        priority: dto.priority ?? 'MEDIUM',
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      },
      include: ACTION_INCLUDE,
    });
    await this.timeline.record({
      processId: capa.processId,
      eventType: 'capa.action_created',
      title: `Action "${dto.title}" created`,
      entityType: 'capa_action',
      entityId: action.id,
      actorId: actor.actorId,
    });
    return this.toDto(action, new Date());
  }

  async update(
    actionId: string,
    dto: UpdateActionDto,
    actor: ActorContext,
    scope: DataScope | undefined,
  ): Promise<CapaActionDto> {
    const action = await this.prisma.capaAction.findUnique({
      where: { id: actionId },
      include: { ...ACTION_INCLUDE, capa: { select: { departmentId: true } } },
    });
    if (!action) throw new NotFoundException('Action not found');
    this.assertCapaScopeMatch(action.capa.departmentId, scope);
    const data: Prisma.CapaActionUncheckedUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.actionType !== undefined) data.actionType = dto.actionType;
    if (dto.ownerId !== undefined) data.ownerId = dto.ownerId;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.dueDate !== undefined) data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    if (dto.status !== undefined) {
      data.status = dto.status;
      if (dto.status === 'COMPLETED') data.completedAt = new Date();
    }
    if (dto.completionComment !== undefined) data.completionComment = dto.completionComment;
    const updated = await this.prisma.capaAction.update({
      where: { id: actionId },
      data,
      include: ACTION_INCLUDE,
    });
    if (dto.status === 'COMPLETED') {
      const capa = await this.prisma.capa.findUnique({
        where: { id: action.capaId },
        select: { processId: true, referenceNumber: true },
      });
      await this.timeline.record({
        processId: capa?.processId,
        eventType: 'capa.action_completed',
        title: `Action "${updated.title}" completed`,
        entityType: 'capa_action',
        entityId: actionId,
        actorId: actor.actorId,
      });
    }
    return this.toDto(updated, new Date());
  }

  async remove(actionId: string, scope: DataScope | undefined): Promise<void> {
    const action = await this.prisma.capaAction.findUnique({
      where: { id: actionId },
      include: { capa: { select: { departmentId: true } } },
    });
    if (!action) throw new NotFoundException('Action not found');
    this.assertCapaScopeMatch(action.capa.departmentId, scope);
    await this.prisma.capaAction.delete({ where: { id: actionId } });
  }

  async uploadEvidence(
    actionId: string,
    file: { originalname: string; buffer: Buffer; mimetype: string; size: number },
    comment: string | null,
    actor: ActorContext,
    scope: DataScope | undefined,
  ): Promise<void> {
    const action = await this.prisma.capaAction.findUnique({
      where: { id: actionId },
      include: { capa: { select: { processId: true, departmentId: true } } },
    });
    if (!action) throw new NotFoundException('Action not found');
    this.assertCapaScopeMatch(action.capa.departmentId, scope);
    const fileKey = `capas/${action.capaId}/${randomUUID()}/${file.originalname}`;
    await this.storage.putObject(fileKey, file.buffer, file.mimetype);
    await this.prisma.capaActionEvidence.create({
      data: {
        actionId,
        fileKey,
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        comment,
        uploadedById: actor.actorId ?? '',
      },
    });
    await this.timeline.record({
      processId: action.capa.processId,
      eventType: 'capa.evidence_uploaded',
      title: `Evidence uploaded: ${file.originalname}`,
      entityType: 'capa_action',
      entityId: actionId,
      actorId: actor.actorId,
    });
  }

  async downloadUrl(
    actionId: string,
    evidenceId: string,
    scope: DataScope | undefined,
  ): Promise<{ url: string }> {
    const evidence = await this.prisma.capaActionEvidence.findFirst({
      where: { id: evidenceId, actionId },
      include: { action: { include: { capa: { select: { departmentId: true } } } } },
    });
    if (!evidence) throw new NotFoundException('Evidence not found');
    this.assertCapaScopeMatch(evidence.action.capa.departmentId, scope, 'Evidence not found');
    return { url: await this.storage.presignedDownloadUrl(evidence.fileKey) };
  }

  /** List an action's evidence metadata — the frontend fetches each file's bytes via downloadUrl()/streamEvidence(). */
  async listEvidence(
    actionId: string,
    scope: DataScope | undefined,
  ): Promise<CapaActionEvidenceDto[]> {
    const action = await this.prisma.capaAction.findUnique({
      where: { id: actionId },
      include: { capa: { select: { departmentId: true } } },
    });
    if (!action) throw new NotFoundException('Action not found');
    this.assertCapaScopeMatch(action.capa.departmentId, scope);
    const evidence = await this.prisma.capaActionEvidence.findMany({
      where: { actionId },
      orderBy: { createdAt: 'asc' },
      include: { uploadedBy: { select: { firstName: true, lastName: true } } },
    });
    return evidence.map((e) => ({
      id: e.id,
      actionId: e.actionId,
      fileName: e.fileName,
      mimeType: e.mimeType,
      sizeBytes: e.sizeBytes,
      comment: e.comment,
      uploadedById: e.uploadedById,
      uploadedByName: fullName(e.uploadedBy),
      createdAt: e.createdAt.toISOString(),
    }));
  }

  /** Resolves the CAPA within `scope`, throwing NotFound if it doesn't exist or belongs to another department. */
  private async assertCapaInScope(capaId: string, scope: DataScope | undefined) {
    const capa = await this.prisma.capa.findFirst({
      where: departmentScopeWhere(scope, { id: capaId, deletedAt: null }) as Prisma.CapaWhereInput,
    });
    if (!capa) throw new NotFoundException('CAPA not found');
    return capa;
  }

  /** Actions/evidence have no departmentId of their own — scope is derived from the parent CAPA. */
  private assertCapaScopeMatch(
    capaDepartmentId: string,
    scope: DataScope | undefined,
    message = 'Action not found',
  ): void {
    if (scope && !scope.isGlobal && capaDepartmentId !== scope.departmentId) {
      throw new NotFoundException(message);
    }
  }

  /**
   * Manager-only (gated by `capas.verify`, same permission as the general
   * CAPA verification — Pilots never hold it). Reviewable only while the
   * parent CAPA is PENDING_VERIFICATION, matching "when an Audit Manager
   * reviews a submitted CAPA" — the same moment the general verification
   * happens. Creates an immutable CapaActionVerification row (never
   * overwritten) and moves the action's own status: PASSED → VERIFIED,
   * FAILED → IN_PROGRESS (ready for the Pilot to rework and resubmit).
   */
  async verifyAction(
    actionId: string,
    dto: VerifyActionDto,
    actor: ActorContext,
    scope: DataScope | undefined,
  ): Promise<CapaActionDto> {
    if (dto.result === 'FAILED' && !dto.notes?.trim()) {
      throw new BadRequestException('A reason is required when failing an action');
    }
    const action = await this.prisma.capaAction.findUnique({
      where: { id: actionId },
      include: {
        ...ACTION_INCLUDE,
        capa: {
          select: {
            id: true,
            departmentId: true,
            status: true,
            processId: true,
            referenceNumber: true,
            title: true,
            ownerId: true,
            createdById: true,
          },
        },
      },
    });
    if (!action) throw new NotFoundException('Action not found');
    this.assertCapaScopeMatch(action.capa.departmentId, scope);
    if (action.capa.status !== 'PENDING_VERIFICATION') {
      throw new ConflictException(
        'The parent CAPA must be in PENDING_VERIFICATION to verify an individual action',
      );
    }

    const verification = await this.prisma.capaActionVerification.create({
      data: {
        actionId,
        verifiedById: actor.actorId!,
        result: dto.result,
        notes: dto.notes ?? null,
      },
    });
    const nextActionStatus = dto.result === 'PASSED' ? 'VERIFIED' : 'IN_PROGRESS';
    const updated = await this.prisma.capaAction.update({
      where: { id: actionId },
      data: { status: nextActionStatus },
      include: ACTION_INCLUDE,
    });

    await this.timeline.record({
      processId: action.capa.processId,
      eventType: `capa.action_verification_${dto.result.toLowerCase()}`,
      title: `Action "${updated.title}" verification ${dto.result} → ${nextActionStatus}`,
      entityType: 'capa_action',
      entityId: actionId,
      actorId: actor.actorId,
    });
    await this.auditLog.record({
      actorId: actor.actorId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      action: `capa_action.verify_${dto.result.toLowerCase()}`,
      entityType: 'capa_action',
      entityId: actionId,
      metadata: { notes: dto.notes, nextActionStatus },
    });

    await this.notifyActionVerification(
      action.capa,
      updated.title,
      verification.id,
      dto.result,
      dto.notes ?? null,
      actor,
    );

    return this.toDto(updated, new Date());
  }

  /** Mirrors CapaService.notifyVerificationResult(): recipient = CAPA owner, falling
   * back to its creator; skips self-notify; entityId = the verification attempt's
   * own id so NotificationService.emit()'s per-(type,entityId,userId) dedup can
   * never collapse two distinct attempts on the same action into one notification. */
  private async notifyActionVerification(
    capa: {
      id: string;
      referenceNumber: string;
      departmentId: string;
      ownerId: string | null;
      createdById: string;
    },
    actionTitle: string,
    verificationId: string,
    result: 'PASSED' | 'FAILED',
    notes: string | null,
    actor: ActorContext,
  ): Promise<void> {
    const recipientId = capa.ownerId ?? capa.createdById;
    if (recipientId === actor.actorId) return;

    await this.notifications
      .emit({
        userId: recipientId,
        type: result === 'FAILED' ? 'CAPA_ACTION_FAILED' : 'CAPA_ACTION_VERIFIED',
        category: 'capa',
        severity: result === 'FAILED' ? 'WARNING' : 'SUCCESS',
        params: { reference: capa.referenceNumber, actionTitle, notes: notes ?? undefined },
        entityType: 'capa_action_verification',
        entityId: verificationId,
        actionUrl: `/capas/${capa.id}`,
        departmentId: capa.departmentId,
      })
      .catch(() => undefined);
  }

  private toDto(
    action: Prisma.CapaActionGetPayload<{ include: typeof ACTION_INCLUDE }>,
    now: Date,
  ): CapaActionDto {
    return {
      id: action.id,
      capaId: action.capaId,
      title: action.title,
      description: action.description,
      actionType: action.actionType,
      ownerId: action.ownerId,
      ownerName: fullName(action.owner),
      priority: action.priority,
      status: action.status,
      dueDate: action.dueDate?.toISOString() ?? null,
      completedAt: action.completedAt?.toISOString() ?? null,
      completionComment: action.completionComment,
      isOverdue: action.dueDate
        ? action.dueDate < now &&
          action.status !== 'COMPLETED' &&
          action.status !== 'VERIFIED' &&
          action.status !== 'CANCELLED'
        : false,
      verificationStatus: latestActionVerificationStatus(action.verifications),
      verifications: action.verifications.map((v) => ({
        id: v.id,
        actionId: v.actionId,
        verifiedById: v.verifiedById,
        verifiedByName: fullName(v.verifiedBy),
        result: v.result,
        notes: v.notes,
        verifiedAt: v.verifiedAt.toISOString(),
      })),
      createdAt: action.createdAt.toISOString(),
      updatedAt: action.updatedAt.toISOString(),
    };
  }
}

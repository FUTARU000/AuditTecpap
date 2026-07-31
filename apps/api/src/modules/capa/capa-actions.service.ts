import { Injectable, NotFoundException } from '@nestjs/common';
import type { CapaActionDto } from '@tecpap/types';
import type { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import type { ActorContext } from '../../common/context/actor';
import { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import type { CreateActionDto, UpdateActionDto } from './dto/capa.dto';

const ACTION_INCLUDE = { owner: { select: { firstName: true, lastName: true } }, _count: { select: { evidence: true } } } satisfies Prisma.CapaActionInclude;

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
  ) {}

  async list(capaId: string): Promise<CapaActionDto[]> {
    const actions = await this.prisma.capaAction.findMany({ where: { capaId }, orderBy: { createdAt: 'asc' }, include: ACTION_INCLUDE });
    const now = new Date();
    return actions.map((a) => this.toDto(a, now));
  }

  async create(capaId: string, dto: CreateActionDto, actor: ActorContext): Promise<CapaActionDto> {
    const capa = await this.prisma.capa.findFirst({ where: { id: capaId, deletedAt: null } });
    if (!capa) throw new NotFoundException('CAPA not found');
    const action = await this.prisma.capaAction.create({
      data: { capaId, title: dto.title, description: dto.description ?? null, actionType: dto.actionType ?? 'CORRECTIVE', ownerId: dto.ownerId ?? null, priority: dto.priority ?? 'MEDIUM', dueDate: dto.dueDate ? new Date(dto.dueDate) : null },
      include: ACTION_INCLUDE,
    });
    await this.timeline.record({ processId: capa.processId, eventType: 'capa.action_created', title: `Action "${dto.title}" created`, entityType: 'capa_action', entityId: action.id, actorId: actor.actorId });
    return this.toDto(action, new Date());
  }

  async update(actionId: string, dto: UpdateActionDto, actor: ActorContext): Promise<CapaActionDto> {
    const action = await this.prisma.capaAction.findUnique({ where: { id: actionId }, include: ACTION_INCLUDE });
    if (!action) throw new NotFoundException('Action not found');
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
    const updated = await this.prisma.capaAction.update({ where: { id: actionId }, data, include: ACTION_INCLUDE });
    if (dto.status === 'COMPLETED') {
      const capa = await this.prisma.capa.findUnique({ where: { id: action.capaId }, select: { processId: true, referenceNumber: true } });
      await this.timeline.record({ processId: capa?.processId, eventType: 'capa.action_completed', title: `Action "${updated.title}" completed`, entityType: 'capa_action', entityId: actionId, actorId: actor.actorId });
    }
    return this.toDto(updated, new Date());
  }

  async remove(actionId: string): Promise<void> {
    const action = await this.prisma.capaAction.findUnique({ where: { id: actionId } });
    if (!action) throw new NotFoundException('Action not found');
    await this.prisma.capaAction.delete({ where: { id: actionId } });
  }

  async uploadEvidence(actionId: string, file: { originalname: string; buffer: Buffer; mimetype: string; size: number }, comment: string | null, actor: ActorContext): Promise<void> {
    const action = await this.prisma.capaAction.findUnique({ where: { id: actionId }, include: { capa: { select: { processId: true } } } });
    if (!action) throw new NotFoundException('Action not found');
    const fileKey = `capas/${action.capaId}/${randomUUID()}/${file.originalname}`;
    await this.storage.putObject(fileKey, file.buffer, file.mimetype);
    await this.prisma.capaActionEvidence.create({ data: { actionId, fileKey, fileName: file.originalname, mimeType: file.mimetype, sizeBytes: file.size, comment, uploadedById: actor.actorId ?? '' } });
    await this.timeline.record({ processId: action.capa.processId, eventType: 'capa.evidence_uploaded', title: `Evidence uploaded: ${file.originalname}`, entityType: 'capa_action', entityId: actionId, actorId: actor.actorId });
  }

  async downloadUrl(actionId: string, evidenceId: string): Promise<{ url: string }> {
    const evidence = await this.prisma.capaActionEvidence.findFirst({ where: { id: evidenceId, actionId } });
    if (!evidence) throw new NotFoundException('Evidence not found');
    return { url: await this.storage.presignedDownloadUrl(evidence.fileKey) };
  }

  private toDto(action: Prisma.CapaActionGetPayload<{ include: typeof ACTION_INCLUDE }>, now: Date): CapaActionDto {
    return {
      id: action.id, capaId: action.capaId, title: action.title, description: action.description, actionType: action.actionType,
      ownerId: action.ownerId, ownerName: fullName(action.owner), priority: action.priority, status: action.status,
      dueDate: action.dueDate?.toISOString() ?? null, completedAt: action.completedAt?.toISOString() ?? null, completionComment: action.completionComment,
      isOverdue: action.dueDate ? action.dueDate < now && action.status !== 'COMPLETED' && action.status !== 'VERIFIED' && action.status !== 'CANCELLED' : false,
      createdAt: action.createdAt.toISOString(), updatedAt: action.updatedAt.toISOString(),
    };
  }
}

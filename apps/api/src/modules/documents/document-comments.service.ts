import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { DocumentCommentDto } from '@tecpap/types';
import type { ActorContext } from '../../common/context/actor';
import type { DataScope } from '../../common/types/data-scope';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import { NotificationService } from '../productivity/notification.service';
import { loadScopedDocument, fullName } from './document-experience.util';

/** Threaded document comments with @mentions, edit history, resolve and timeline. */
@Injectable()
export class DocumentCommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timeline: ActivityTimelineService,
    private readonly notifications: NotificationService,
  ) {}

  async list(documentId: string, scope: DataScope | undefined): Promise<DocumentCommentDto[]> {
    await loadScopedDocument(this.prisma, documentId, scope);
    const rows = await this.prisma.documentComment.findMany({
      where: { documentId },
      include: { author: { select: { firstName: true, lastName: true } }, resolvedBy: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const map = new Map<string, DocumentCommentDto>();
    const roots: DocumentCommentDto[] = [];
    for (const r of rows) {
      const dto = this.toDto(r);
      dto.replies = [];
      map.set(dto.id, dto);
    }
    for (const r of rows) {
      const dto = map.get(r.id)!;
      if (r.parentId && map.has(r.parentId)) map.get(r.parentId)!.replies.push(dto);
      else roots.push(dto);
    }
    return roots;
  }

  async create(documentId: string, body: string, actor: ActorContext, scope: DataScope | undefined, versionId?: string, parentId?: string): Promise<DocumentCommentDto> {
    const doc = await loadScopedDocument(this.prisma, documentId, scope);
    if (parentId) {
      const parent = await this.prisma.documentComment.findUnique({ where: { id: parentId }, select: { documentId: true } });
      if (!parent || parent.documentId !== documentId) throw new BadRequestException('Invalid parent comment');
    }
    const mentions = await this.resolveMentions(body);
    const created = await this.prisma.documentComment.create({
      data: { documentId, versionId: versionId ?? null, parentId: parentId ?? null, authorId: actor.actorId!, body, mentions },
      include: { author: { select: { firstName: true, lastName: true } }, resolvedBy: { select: { firstName: true, lastName: true } } },
    });
    await this.timeline.record({ processId: doc.processId, eventType: 'document.commented', title: `New comment on ${doc.code}`, entityType: 'document', entityId: documentId, actorId: actor.actorId });
    for (const userId of mentions) {
      if (userId !== actor.actorId) {
        await this.notifications.emit({
          userId, type: 'COMMENT_MENTION', category: 'document', severity: 'INFO',
          title: `You were mentioned in ${doc.code}`, message: body.slice(0, 200),
          entityType: 'document', entityId: documentId, actionUrl: `/documents/${documentId}/viewer`,
        });
      }
    }
    return this.toDto(created);
  }

  async edit(commentId: string, body: string, actor: ActorContext): Promise<DocumentCommentDto> {
    const existing = await this.prisma.documentComment.findUnique({ where: { id: commentId } });
    if (!existing) throw new NotFoundException('Comment not found');
    if (existing.authorId !== actor.actorId) throw new BadRequestException('Only the author can edit a comment');
    const updated = await this.prisma.documentComment.update({
      where: { id: commentId },
      data: { body, editedAt: new Date(), previousBodies: this.pushHistory(existing.previousBodies, existing.body, existing.editedAt ?? existing.createdAt) as unknown as Prisma.InputJsonValue },
      include: { author: { select: { firstName: true, lastName: true } }, resolvedBy: { select: { firstName: true, lastName: true } } },
    });
    return this.toDto(updated);
  }

  async resolve(commentId: string, resolved: boolean, actor: ActorContext): Promise<DocumentCommentDto> {
    const existing = await this.prisma.documentComment.findUnique({ where: { id: commentId }, select: { documentId: true, resolved: true } });
    if (!existing) throw new NotFoundException('Comment not found');
    const updated = await this.prisma.documentComment.update({
      where: { id: commentId },
      data: { resolved, resolvedById: resolved ? actor.actorId : null, resolvedAt: resolved ? new Date() : null },
      include: { author: { select: { firstName: true, lastName: true } }, resolvedBy: { select: { firstName: true, lastName: true } } },
    });
    if (resolved) {
      const doc = await this.prisma.controlledDocument.findUnique({ where: { id: existing.documentId }, select: { code: true, processId: true } });
      await this.timeline.record({ processId: doc?.processId ?? null, eventType: 'document.comment_resolved', title: `Comment resolved on ${doc?.code ?? existing.documentId}`, entityType: 'document', entityId: existing.documentId, actorId: actor.actorId });
    }
    return this.toDto(updated);
  }

  async remove(commentId: string, actor: ActorContext): Promise<void> {
    const existing = await this.prisma.documentComment.findUnique({ where: { id: commentId }, select: { authorId: true } });
    if (!existing) throw new NotFoundException('Comment not found');
    if (existing.authorId !== actor.actorId) throw new BadRequestException('Only the author can delete a comment');
    await this.prisma.documentComment.delete({ where: { id: commentId } });
  }

  private async resolveMentions(body: string): Promise<string[]> {
    const emails = [...body.matchAll(/@([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g)].map((m) => (m[1] ?? '').toLowerCase()).filter(Boolean);
    if (emails.length === 0) return [];
    const users = await this.prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
    return users.map((u) => u.id);
  }

  private pushHistory(prev: Prisma.JsonValue | null, body: string, at: Date): unknown[] {
    const arr = Array.isArray(prev) ? [...prev] : [];
    arr.push({ body, at: at.toISOString() });
    return arr;
  }

  private toDto(r: Prisma.DocumentCommentGetPayload<{ include: { author: { select: { firstName: true; lastName: true } }; resolvedBy: { select: { firstName: true; lastName: true } } } }>): DocumentCommentDto {
    return {
      id: r.id, documentId: r.documentId, versionId: r.versionId, parentId: r.parentId,
      authorId: r.authorId, authorName: fullName(r.author), body: r.body, mentions: r.mentions,
      resolved: r.resolved, resolvedById: r.resolvedById, resolvedAt: r.resolvedAt?.toISOString() ?? null,
      editedAt: r.editedAt?.toISOString() ?? null, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
      replies: [],
    };
  }
}

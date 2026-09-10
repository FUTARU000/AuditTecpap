import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { NotificationSeverity, NotificationType, NotificationDto, PaginatedResult } from '@tecpap/types';
import { renderNotification, type NotificationTemplateParams } from '@tecpap/config';
import { paginated, parsePagination } from '../../common/pagination/pagination';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { EMAIL_PROVIDER, type EmailProvider } from './email-provider.tokens';

export interface EmitInput {
  userId: string;
  type: NotificationType;
  category: string;
  severity?: NotificationSeverity;
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
  departmentId?: string;
  /** Dedup window in hours (default 24). Prevents reminder spam for the same event. */
  dedupHours?: number;
  /**
   * Phase 5 — preferred over `title`/`message`: structured params rendered
   * through the shared EN/FR template catalog (@tecpap/config). The English
   * rendering is stored as the `title`/`message` fallback (and used for the
   * email body); the params are stored too, so the frontend can re-render
   * the user's active locale at read time without a second database write.
   */
  params?: NotificationTemplateParams;
  /**
   * Literal text — required when `type` has no template in the shared
   * catalog (e.g. COMMENT_MENTION, whose body is free-text user content,
   * not a translatable template) or as an explicit override. Ignored when
   * `params` successfully resolves against a template.
   */
  title?: string;
  message?: string;
}

@Injectable()
export class NotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
  ) {}

  /** Create an in-app notification (+ email via provider) with per-event dedup. Returns the row or null when deduped. */
  async emit(input: EmitInput): Promise<NotificationDto | null> {
    if (input.entityId) {
      const since = new Date(Date.now() - (input.dedupHours ?? 24) * 3600_000);
      const exists = await this.prisma.notification.findFirst({
        where: { type: input.type, entityId: input.entityId, userId: input.userId, createdAt: { gte: since } },
        select: { id: true },
      });
      if (exists) return null;
    }

    // Phase 5: prefer the shared template catalog. The English rendering is
    // what gets stored (legacy-compatible fallback text + email body); the
    // params travel alongside so the frontend can re-render in French.
    const rendered = input.params ? renderNotification(input.type, 'en', input.params) : null;
    const title = rendered?.title ?? input.title;
    const message = rendered?.message ?? input.message;
    if (!title || !message) {
      throw new Error(`NotificationService.emit: no template registered for type "${input.type}" — pass params (if a template exists) or literal title/message.`);
    }

    const created = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        category: input.category,
        severity: input.severity ?? this.defaultSeverity(input.type),
        title,
        message,
        params: rendered ? (input.params as Prisma.InputJsonValue) : undefined,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        actionUrl: input.actionUrl ?? null,
        departmentId: input.departmentId ?? null,
      },
    });
    // Email delivery (architecture-only; provider is swappable). English only
    // for this phase — see the localization README note in this module.
    const user = await this.prisma.user.findUnique({ where: { id: input.userId }, select: { email: true } });
    if (user) {
      await this.email.send({ to: user.email, subject: title, body: message, meta: { type: input.type } }).catch(() => undefined);
    }
    await this.auditLog.record({ actorId: null, action: 'notification.sent', entityType: 'notification', entityId: created.id, metadata: { type: input.type, userId: input.userId } });
    return this.toDto(created);
  }

  async list(userId: string, query: { page?: number; pageSize?: number; unread?: boolean; archived?: boolean; type?: string; category?: string; search?: string }): Promise<PaginatedResult<NotificationDto>> {
    const { skip, take, page, pageSize } = parsePagination(query);
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(query.unread ? { readAt: null, archivedAt: null } : {}),
      ...(query.archived ? { archivedAt: { not: null } } : { archivedAt: null }),
      ...(query.type ? { type: query.type } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.search ? { OR: [{ title: { contains: query.search, mode: 'insensitive' } }, { message: { contains: query.search, mode: 'insensitive' } }] } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.notification.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      this.prisma.notification.count({ where }),
    ]);
    return paginated(rows.map((r) => this.toDto(r)), total, page, pageSize);
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null, archivedAt: null } });
  }

  async markRead(id: string, userId: string): Promise<void> {
    await this.own(id, userId);
    await this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
    await this.auditLog.record({ actorId: userId, action: 'notification.read', entityType: 'notification', entityId: id });
  }

  async markAllRead(userId: string): Promise<number> {
    const r = await this.prisma.notification.updateMany({ where: { userId, readAt: null, archivedAt: null }, data: { readAt: new Date() } });
    return r.count;
  }

  async archive(id: string, userId: string): Promise<void> {
    await this.own(id, userId);
    await this.prisma.notification.update({ where: { id }, data: { archivedAt: new Date() } });
    await this.auditLog.record({ actorId: userId, action: 'notification.archived', entityType: 'notification', entityId: id });
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.own(id, userId);
    await this.prisma.notification.delete({ where: { id } });
  }

  private async own(id: string, userId: string): Promise<void> {
    const n = await this.prisma.notification.findUnique({ where: { id }, select: { userId: true } });
    if (!n || n.userId !== userId) throw new NotFoundException('Notification not found');
  }

  private defaultSeverity(type: NotificationType): NotificationSeverity {
    if (['CAPA_OVERDUE', 'AUDIT_OVERDUE', 'KPI_THRESHOLD_EXCEEDED'].includes(type)) return 'CRITICAL';
    if (type.endsWith('_OVERDUE') || type === 'CERTIFICATE_EXPIRING' || type === 'DOCUMENT_REJECTED') return 'WARNING';
    if (type === 'CAPA_COMPLETED' || type === 'DOCUMENT_APPROVED' || type === 'IMPORT_COMPLETED') return 'SUCCESS';
    return 'INFO';
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  private toDto(n: Prisma.NotificationGetPayload<{}>): NotificationDto {
    return {
      id: n.id, type: n.type, category: n.category, severity: n.severity as NotificationSeverity,
      title: n.title, message: n.message,
      params: (n.params as Record<string, string | number | boolean> | null) ?? null,
      entityType: n.entityType, entityId: n.entityId,
      actionUrl: n.actionUrl, departmentId: n.departmentId,
      readAt: n.readAt?.toISOString() ?? null, archivedAt: n.archivedAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    };
  }
}

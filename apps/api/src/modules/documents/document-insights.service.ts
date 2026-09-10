import { Injectable } from '@nestjs/common';
import { DOCUMENT_EXPIRING_WINDOW_DAYS } from '@tecpap/config';
import type { DocumentInsightsDto } from '@tecpap/types';
import type { Prisma } from '@prisma/client';
import { departmentScopeWhere } from '../../common/scoping/scope';
import type { DataScope } from '../../common/types/data-scope';
import { PrismaService } from '../prisma/prisma.service';

/** Document analytics — computed on demand from timeline events, comments, acknowledgements and document state. */
@Injectable()
export class DocumentInsightsService {
  constructor(private readonly prisma: PrismaService) {}

  async insights(scope: DataScope | undefined): Promise<DocumentInsightsDto> {
    const docWhere = departmentScopeWhere(scope, { deletedAt: null }) as Prisma.ControlledDocumentWhereInput;
    const now = new Date();
    const soon = new Date(now.getTime() + DOCUMENT_EXPIRING_WINDOW_DAYS * 24 * 3600_000);

    const [viewedRaw, downloadedRaw, commentedRaw, ackRaw, recent, pendingReview, expiringSoon, avgReview] = await Promise.all([
      this.topDocs('document.viewed', scope),
      this.topDocs('document.downloaded', scope),
      this.prisma.documentComment.groupBy({ by: ['documentId'], _count: true, orderBy: { _count: { documentId: 'desc' } }, take: 10 }),
      this.prisma.documentAcknowledgement.groupBy({ by: ['documentId'], _count: true, orderBy: { _count: { documentId: 'desc' } }, take: 10 }),
      this.prisma.controlledDocument.findMany({ where: docWhere, orderBy: { updatedAt: 'desc' }, take: 5, select: { id: true, title: true, code: true, updatedAt: true } }),
      this.prisma.controlledDocument.count({ where: { ...docWhere, status: 'UNDER_REVIEW' } }),
      this.prisma.controlledDocument.count({ where: { ...docWhere, expirationDate: { gte: now, lte: soon } } }),
      this.prisma.controlledDocument.aggregate({ _avg: { revision: true }, where: { ...docWhere, status: { in: ['APPROVED', 'PUBLISHED'] } } }),
    ]);

    const docMeta = await this.loadMeta([...viewedRaw, ...downloadedRaw, ...commentedRaw.map((c) => ({ documentId: c.documentId })), ...ackRaw.map((a) => ({ documentId: a.documentId })), ...recent.map((r) => ({ documentId: r.id }))], scope);
    const pick = (rows: { documentId: string; count?: number }[] | { documentId: string; _count: number }[]) =>
      rows.map((r) => ({ id: r.documentId, count: '_count' in r ? r._count : (r.count ?? 0) })).map((x) => ({ ...docMeta.get(x.id), count: x.count })).filter((d): d is { id: string; title: string; code: string; count: number } => !!d.id).slice(0, 5);

    return {
      mostViewed: pick(viewedRaw),
      mostDownloaded: pick(downloadedRaw),
      mostCommented: pick(commentedRaw.map((c) => ({ documentId: c.documentId, _count: c._count }))),
      mostAcknowledged: pick(ackRaw.map((a) => ({ documentId: a.documentId, _count: a._count }))),
      recentlyUpdated: recent.map((r) => ({ id: r.id, title: r.title, code: r.code, updatedAt: r.updatedAt.toISOString() })),
      pendingReview,
      expiringSoon,
      // Revision-based proxy until explicit review durations are tracked.
      averageReviewDays: avgReview._avg.revision !== null ? Math.round(avgReview._avg.revision ?? 0) : null,
    };
  }

  private async topDocs(eventType: string, scope: DataScope | undefined) {
    const rows = await this.prisma.activityTimeline.groupBy({
      by: ['entityId'], where: { entityType: 'document', eventType }, _count: true, orderBy: { _count: { entityId: 'desc' } }, take: 20,
    });
    return rows.map((r) => ({ documentId: r.entityId ?? '', count: r._count })).filter((r) => r.documentId);
  }

  private async loadMeta(ids: { documentId: string }[], scope: DataScope | undefined) {
    const unique = [...new Set(ids.map((i) => i.documentId))];
    if (unique.length === 0) return new Map<string, { id: string; title: string; code: string }>();
    const docs = await this.prisma.controlledDocument.findMany({
      where: { id: { in: unique }, ...departmentScopeWhere(scope, { deletedAt: null }) },
      select: { id: true, title: true, code: true },
    });
    return new Map(docs.map((d) => [d.id, { id: d.id, title: d.title, code: d.code }]));
  }
}

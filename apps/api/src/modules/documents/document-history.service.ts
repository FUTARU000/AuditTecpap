import { Injectable } from '@nestjs/common';
import type { DocumentHistoryEventDto } from '@tecpap/types';
import type { DataScope } from '../../common/types/data-scope';
import { PrismaService } from '../prisma/prisma.service';
import { loadScopedDocument, fullName } from './document-experience.util';

/** Unified document history — merges the activity timeline + the audit log for one document. */
@Injectable()
export class DocumentHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async history(documentId: string, scope: DataScope | undefined): Promise<DocumentHistoryEventDto[]> {
    await loadScopedDocument(this.prisma, documentId, scope);
    const [timeline, audit] = await Promise.all([
      this.prisma.activityTimeline.findMany({
        where: { entityType: 'document', entityId: documentId },
        include: { actor: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.auditLog.findMany({ where: { entityType: 'document', entityId: documentId }, include: { actor: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' }, take: 50 }),
    ]);
    const events: DocumentHistoryEventDto[] = [
      ...timeline.map((t) => ({ id: t.id, eventType: t.eventType, title: t.title, actorName: fullName(t.actor), createdAt: t.createdAt.toISOString() })),
      ...audit.map((a) => ({ id: a.id, eventType: a.action, title: a.target ?? a.action, actorName: fullName(a.actor), createdAt: a.createdAt.toISOString() })),
    ];
    return events.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

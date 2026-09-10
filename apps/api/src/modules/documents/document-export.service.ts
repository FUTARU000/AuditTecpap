import { Injectable, NotFoundException } from '@nestjs/common';
import JSZip from 'jszip';
import type { ActorContext } from '../../common/context/actor';
import type { DataScope } from '../../common/types/data-scope';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import { loadScopedDocument } from './document-experience.util';

/** Exports — metadata/version-history/relationship-graph JSON and a self-contained offline audit ZIP. */
@Injectable()
export class DocumentExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly timeline: ActivityTimelineService,
  ) {}

  async metadata(documentId: string, scope: DataScope | undefined) {
    await loadScopedDocument(this.prisma, documentId, scope);
    return this.prisma.controlledDocument.findUnique({
      where: { id: documentId },
      include: {
        department: { select: { name: true } },
        category: { select: { name: true } },
        process: { select: { name: true } },
        owner: { select: { firstName: true, lastName: true } },
        versions: { orderBy: { revision: 'desc' }, include: { uploadedBy: { select: { firstName: true, lastName: true } } } },
      },
    });
  }

  async versionHistory(documentId: string, scope: DataScope | undefined) {
    await loadScopedDocument(this.prisma, documentId, scope);
    return this.prisma.documentVersion.findMany({ where: { documentId }, orderBy: { revision: 'desc' } });
  }

  async relationshipGraph(documentId: string, scope: DataScope | undefined) {
    await loadScopedDocument(this.prisma, documentId, scope);
    const [typed, polymorphic] = await Promise.all([
      this.prisma.documentRelation.findMany({ where: { OR: [{ sourceDocumentId: documentId }, { targetDocumentId: documentId }] }, include: { sourceDocument: { select: { code: true, title: true } }, targetDocument: { select: { code: true, title: true } } } }),
      this.prisma.businessRelationship.findMany({ where: { OR: [{ sourceType: 'document', sourceId: documentId }, { targetType: 'document', targetId: documentId }] } }),
    ]);
    return { typedRelations: typed, businessRelationships: polymorphic };
  }

  /** ZIP the document + referenced documents' latest approved files + metadata.json — for external audits. */
  async offlinePackage(documentId: string, scope: DataScope | undefined, actor: ActorContext): Promise<{ buffer: Buffer; filename: string }> {
    const doc = await loadScopedDocument(this.prisma, documentId, scope);
    const zip = new JSZip();
    const folder = zip.folder(doc.code)!;

    const currentVersion = await this.prisma.documentVersion.findUnique({ where: { id: doc.currentVersionId ?? '' } });
    if (currentVersion) {
      const bytes = await this.storage.getObject(currentVersion.fileKey).catch(() => null);
      if (bytes) folder.file(currentVersion.fileName, bytes);
    }

    // Include referenced documents' current versions.
    const relations = await this.prisma.documentRelation.findMany({ where: { sourceDocumentId: documentId }, select: { targetDocument: { select: { id: true, code: true, currentVersionId: true } } } });
    for (const rel of relations) {
      const t = rel.targetDocument;
      if (!t.currentVersionId) continue;
      const v = await this.prisma.documentVersion.findUnique({ where: { id: t.currentVersionId }, select: { fileName: true, fileKey: true } });
      if (!v) continue;
      const bytes = await this.storage.getObject(v.fileKey).catch(() => null);
      if (bytes) folder.file(`references/${t.code}/${v.fileName}`, bytes);
    }

    folder.file('metadata.json', JSON.stringify(await this.metadata(documentId, scope), null, 2));
    folder.file('version-history.json', JSON.stringify(await this.versionHistory(documentId, scope), null, 2));
    folder.file('relationships.json', JSON.stringify(await this.relationshipGraph(documentId, scope), null, 2));

    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    await this.timeline.record({ processId: doc.processId, eventType: 'document.exported', title: `${doc.code} offline package exported`, entityType: 'document', entityId: documentId, actorId: actor.actorId });
    return { buffer, filename: `${doc.code}-audit-package.zip` };
  }

  async track(documentId: string, event: 'viewed' | 'downloaded' | 'printed' | 'compared', scope: DataScope | undefined, actor: ActorContext): Promise<void> {
    const doc = await loadScopedDocument(this.prisma, documentId, scope);
    await this.timeline.record({ processId: doc.processId, eventType: `document.${event}`, title: `${doc.code} ${event}`, entityType: 'document', entityId: documentId, actorId: actor.actorId });
  }
}

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { DocumentCompareBlock, DocumentCompareResultDto } from '@tecpap/types';
import type { ActorContext } from '../../common/context/actor';
import type { DataScope } from '../../common/types/data-scope';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import { loadScopedDocument } from './document-experience.util';
import { parseDocumentFile } from './document-parsers';

/** Version comparison — paragraph-level diff (added / removed / modified) + metadata delta. */
@Injectable()
export class DocumentCompareService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly timeline: ActivityTimelineService,
  ) {}

  async compare(documentId: string, aId: string, bId: string, scope: DataScope | undefined, actor: ActorContext): Promise<DocumentCompareResultDto> {
    const doc = await loadScopedDocument(this.prisma, documentId, scope);
    const [a, b] = await Promise.all([
      this.prisma.documentVersion.findFirst({ where: { id: aId, documentId }, select: { id: true, version: true, fileName: true, mimeType: true, fileKey: true, sizeBytes: true, checksum: true, uploadedById: true } }),
      this.prisma.documentVersion.findFirst({ where: { id: bId, documentId }, select: { id: true, version: true, fileName: true, mimeType: true, fileKey: true, sizeBytes: true, checksum: true, uploadedById: true } }),
    ]);
    if (!a || !b) throw new NotFoundException('Version not found');

    const [textA, textB] = await Promise.all([this.extractText(a.fileKey, a.fileName, a.mimeType), this.extractText(b.fileKey, b.fileName, b.mimeType)]);
    const blocks = diff(textA, textB);

    const metadataDiff: { field: string; a: unknown; b: unknown }[] = [];
    for (const field of ['version', 'fileName', 'sizeBytes', 'checksum', 'uploadedById'] as const) {
      if ((a[field] as unknown) !== (b[field] as unknown)) metadataDiff.push({ field, a: a[field], b: b[field] });
    }

    await this.timeline.record({ processId: doc.processId, eventType: 'document.compared', title: `${doc.code} versions compared (${a.version} → ${b.version})`, entityType: 'document', entityId: documentId, actorId: actor.actorId });

    return {
      documentId,
      versionA: { id: a.id, version: a.version },
      versionB: { id: b.id, version: b.version },
      blocks,
      metadataDiff,
      summary: {
        added: blocks.filter((bl) => bl.status === 'added').length,
        removed: blocks.filter((bl) => bl.status === 'removed').length,
        modified: blocks.filter((bl) => bl.status === 'modified').length,
      },
    };
  }

  private async extractText(fileKey: string, fileName: string, mimeType: string): Promise<string> {
    const buffer = await this.storage.getObject(fileKey);
    try {
      const parsed = await parseDocumentFile(fileName, buffer, mimeType);
      return parsed?.content ?? '';
    } catch {
      return '';
    }
  }
}

/** LCS-based paragraph diff, collapsing adjacent remove+add into a single "modified" block. */
function diff(aText: string, bText: string): DocumentCompareBlock[] {
  const a = aText.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const b = bText.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const raw: DocumentCompareBlock[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { raw.push({ status: 'unchanged', a: a[i] }); i++; j++; }
    else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) { raw.push({ status: 'removed', a: a[i] }); i++; }
    else { raw.push({ status: 'added', b: b[j] }); j++; }
  }
  while (i < n) { raw.push({ status: 'removed', a: a[i++] }); }
  while (j < m) { raw.push({ status: 'added', b: b[j++] }); }

  // Collapse a removed immediately followed by an added into "modified".
  const collapsed: DocumentCompareBlock[] = [];
  for (let k = 0; k < raw.length; k++) {
    const cur = raw[k]!;
    const next = raw[k + 1];
    if (cur.status === 'removed' && next?.status === 'added') {
      collapsed.push({ status: 'modified', a: cur.a, b: next.b });
      k++;
    } else {
      collapsed.push(cur);
    }
  }
  return collapsed;
}

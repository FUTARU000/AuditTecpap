import { Injectable, NotFoundException } from '@nestjs/common';
import type { DocumentPreviewDto } from '@tecpap/types';
import type { ActorContext } from '../../common/context/actor';
import type { DataScope } from '../../common/types/data-scope';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import { loadScopedDocument } from './document-experience.util';
import { parseDocumentFile } from './document-parsers';

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'svg', 'gif', 'webp', 'bmp']);
const TEXT_EXTS = new Set(['txt', 'log', 'md', 'text']);
const LEGACY_WORD = new Set(['doc']);
const LEGACY_EXCEL = new Set(['xls']);
const LEGACY_PPT = new Set(['ppt']);
const OOXML_EXTS = new Set(['docx', 'xlsx', 'xlsm', 'pptx', 'pdf']);

type ViewerFormat = 'pdf' | 'word' | 'excel' | 'powerpoint' | 'csv' | 'image' | 'legacy' | 'text' | 'other';

function resolveViewerFormat(ext: string): { format: ViewerFormat; family?: 'word' | 'excel' | 'powerpoint' } {
  if (ext === 'pdf') return { format: 'pdf' };
  if (ext === 'docx') return { format: 'word' };
  if (ext === 'xlsx' || ext === 'xlsm') return { format: 'excel' };
  if (ext === 'pptx') return { format: 'powerpoint' };
  if (ext === 'csv') return { format: 'csv' };
  if (IMAGE_EXTS.has(ext)) return { format: 'image' };
  if (TEXT_EXTS.has(ext)) return { format: 'text' };
  if (LEGACY_WORD.has(ext)) return { format: 'legacy', family: 'word' };
  if (LEGACY_EXCEL.has(ext)) return { format: 'legacy', family: 'excel' };
  if (LEGACY_PPT.has(ext)) return { format: 'legacy', family: 'powerpoint' };
  return { format: 'other' };
}

/** Parse CSV text into rows (RFC 4180 basic — handles quoted fields). */
function parseCsv(text: string, maxRows = 5000): { headers: string[]; rows: string[][]; rowCount: number; truncated: boolean } {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',' || ch === ';' || ch === '\t') { current.push(field); field = ''; }
      else if (ch === '\n') { current.push(field); rows.push(current); current = []; field = ''; if (rows.length >= maxRows) break; }
      else if (ch === '\r') { /* skip */ }
      else field += ch;
    }
  }
  if (field || current.length) { current.push(field); rows.push(current); }
  const headers = rows[0] ?? [];
  return { headers, rows: rows.slice(1), rowCount: rows.length, truncated: rows.length >= maxRows };
}

/** Enterprise preview — serves PDF/images directly; parses Office formats into rich structured data. */
@Injectable()
export class DocumentViewerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly timeline: ActivityTimelineService,
  ) {}

  async preview(documentId: string, scope: DataScope | undefined, actor: ActorContext, versionId?: string): Promise<DocumentPreviewDto> {
    const doc = await loadScopedDocument(this.prisma, documentId, scope);
    const version = await this.prisma.documentVersion.findFirst({
      where: { id: versionId ?? doc.currentVersionId ?? undefined, documentId },
      select: { id: true, version: true, fileName: true, mimeType: true, fileKey: true, sizeBytes: true, checksum: true },
    });
    if (!version) throw new NotFoundException('Version not found');

    const ext = (version.fileName.split('.').pop() ?? '').toLowerCase();
    const { format, family } = resolveViewerFormat(ext);
    const fileUrl = await this.storage.presignedDownloadUrl(version.fileKey);
    let content: Record<string, unknown> = {};

    if (format === 'pdf') {
      // PDF — browser iframe handles everything.
    } else if (format === 'image') {
      content = { src: fileUrl, alt: doc.title };
    } else if (format === 'legacy') {
      content = { family: family ?? 'word', ext, reason: `Legacy Microsoft Office format (.${ext}) cannot be rendered directly.` };
    } else if (format === 'csv') {
      try {
        const buffer = await this.storage.getObject(version.fileKey);
        const text = buffer.toString('utf-8');
        const csvData = parseCsv(text);
        content = csvData;
      } catch { content = { error: 'Could not parse CSV' }; }
    } else if (format === 'text') {
      try {
        const buffer = await this.storage.getObject(version.fileKey);
        const text = buffer.toString('utf-8');
        content = { text, lineCount: text.split('\n').length, truncated: false };
      } catch { content = { text: '', error: 'Could not read file' }; }
    } else if (format === 'word' || format === 'excel' || format === 'powerpoint') {
      try {
        const buffer = await this.storage.getObject(version.fileKey);
        const parsed = await parseDocumentFile(version.fileName, buffer, version.mimeType);
        if (parsed) {
          content = {
            title: parsed.title,
            headings: parsed.headings ?? [],
            keywords: parsed.keywords ?? [],
            text: (parsed.content ?? '').slice(0, 20000),
            excerpt: parsed.contentExcerpt ?? '',
            tables: parsed.tableCount ?? 0,
            pages: parsed.pageCount ?? 0,
            workbookPurpose: parsed.workbookPurpose,
            sections: parsed.sections,
            author: parsed.author,
            revision: parsed.revision,
            html: parsed.html,
            sheets: parsed.sheets,
            slides: parsed.slides,
          };
        }
      } catch {
        content = { error: 'Preview unavailable for this file' };
      }
    } else {
      content = { ext, reason: 'No inline preview available for this file type.' };
    }

    await this.timeline.record({ processId: doc.processId, eventType: 'document.viewed', title: `${doc.code} viewed`, entityType: 'document', entityId: documentId, actorId: actor.actorId });

    return {
      documentId, versionId: version.id, format, title: doc.title, fileUrl, content,
      metadata: { fileName: version.fileName, mimeType: version.mimeType, sizeBytes: version.sizeBytes, checksum: version.checksum, version: version.version, code: doc.code },
    };
  }
}

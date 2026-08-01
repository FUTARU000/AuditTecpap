import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { ImportClassification, ReviewDecision } from '@tecpap/types';
import type { ActorContext } from '../../common/context/actor';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { DocumentsService } from '../documents/documents.service';
import { DocumentVersionsService } from '../documents/document-versions.service';
import { AuditTemplatesService } from '../audit-templates/audit-templates.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import { ClassificationEngine } from './classification.engine';
import { ImportJobService } from './import-job.service';
import type { ReviewOverridesDto } from './dto/import.dto';
import type { ParsedDocument, ParsedTemplateSection } from './interfaces/document-parser.interface';

type QuestionType = 'YES_NO' | 'YES_NO_NA' | 'SHORT_TEXT' | 'LONG_TEXT' | 'NUMBER' | 'DATE' | 'DROPDOWN' | 'CHECKBOX' | 'MULTIPLE_CHOICE';

interface ItemRow {
  id: string;
  jobId: string;
  fileName: string;
  originalPath: string;
  extension: string;
  mimeType: string | null;
  fileKey: string | null;
  targetEntityType: 'AUDIT_TEMPLATE' | 'CONTROLLED_DOCUMENT' | 'BUSINESS_OBJECT' | null;
  parsedMetadata: unknown;
  contentText: string | null;
  classification: unknown;
  status: string;
  duplicateOfId: string | null;
  duplicateStrategy: string | null;
}

/**
 * Import review queue. Nothing becomes official until a reviewer decides; on
 * APPROVE the item is materialized into the right QMS entity via the existing
 * services (DocumentsService + DocumentVersionsService, AuditTemplatesService),
 * with the original file preserved as an immutable version.
 */
@Injectable()
export class ImportReviewService {
  private readonly logger = new Logger(ImportReviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly documents: DocumentsService,
    private readonly versions: DocumentVersionsService,
    private readonly templates: AuditTemplatesService,
    private readonly classification: ClassificationEngine,
    private readonly auditLog: AuditLogService,
    private readonly timeline: ActivityTimelineService,
    private readonly jobs: ImportJobService,
  ) {}

  async review(itemId: string, decision: ReviewDecision, actor: ActorContext, overrides?: ReviewOverridesDto, note?: string): Promise<{ id: string; status: string; importedEntityId: string | null }> {
    const item = await this.prisma.importItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Import item not found');
    if (!['AWAITING_REVIEW', 'DUPLICATE', 'FAILED'].includes(item.status)) {
      throw new BadRequestException(`Item is not reviewable (status: ${item.status})`);
    }

    if (decision === 'REJECT') {
      return this.commit(item.id, { status: 'REJECTED', reviewDecision: 'REJECT', reviewById: actor.actorId, reviewedAt: new Date(), reviewNote: note ?? null }, actor, 'import.item.rejected');
    }

    const parsed = this.toParsed(item);
    const cls = await this.applyOverrides(item.classification as ImportClassification | null, overrides);
    const buffer = item.fileKey ? await this.storage.getObject(item.fileKey) : null;

    try {
      if (decision === 'MERGE') {
        await this.mergeMetadata(item, parsed, actor);
        return this.commit(item.id, { status: 'IMPORTED', reviewDecision: 'MERGE', reviewById: actor.actorId, reviewedAt: new Date(), reviewNote: note ?? null, importedEntityId: item.duplicateOfId, importedEntityType: 'controlled_document', importedAt: new Date() }, actor, 'import.item.merged');
      }

      if (decision === 'REPLACE_VERSION' || (item.duplicateStrategy === 'REPLACE_VERSION' && decision === 'APPROVE')) {
        const docId = item.duplicateOfId;
        if (!docId || !buffer) throw new BadRequestException('No existing document to replace');
        await this.addVersion(docId, item, buffer, parsed, actor);
        return this.commit(item.id, { status: 'IMPORTED', reviewDecision: 'REPLACE_VERSION', reviewById: actor.actorId, reviewedAt: new Date(), reviewNote: note ?? null, importedEntityId: docId, importedEntityType: 'controlled_document', importedAt: new Date() }, actor, 'import.item.version_added');
      }

      // APPROVE → materialize a new entity.
      const result = await this.materialize(item, parsed, cls, buffer, actor);
      return this.commit(item.id, { status: 'IMPORTED', reviewDecision: 'APPROVE', reviewById: actor.actorId, reviewedAt: new Date(), reviewNote: note ?? null, importedEntityId: result.id, importedEntityType: result.type, importedAt: new Date() }, actor, result.auditAction);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Materialization failed for ${item.fileName}: ${message}`);
      await this.prisma.importItem.update({ where: { id: item.id }, data: { status: 'FAILED', error: message } });
      throw error;
    }
  }

  /** Bulk-approve every reviewable item (used by the demo + "approve all"). */
  async approveAll(jobId: string, actor: ActorContext): Promise<number> {
    const items = await this.prisma.importItem.findMany({ where: { jobId, status: 'AWAITING_REVIEW' }, select: { id: true } });
    let ok = 0;
    for (const i of items) {
      try {
        await this.review(i.id, 'APPROVE', actor);
        ok++;
      } catch (e) {
        this.logger.warn(`approveAll skipped ${i.id}: ${String(e)}`);
      }
    }
    return ok;
  }

  // ----------------------------------------------------------- materialize
  private async materialize(item: ItemRow, parsed: ParsedDocument, cls: ImportClassification, buffer: Buffer | null, actor: ActorContext): Promise<{ id: string; type: string; auditAction: string }> {
    if (item.targetEntityType === 'AUDIT_TEMPLATE' && parsed.sections && parsed.sections.length > 0) {
      const tpl = await this.templates.create(
        {
          name: parsed.title || item.fileName,
          description: parsed.description ?? undefined,
          category: 'Quality Audit',
          departmentId: cls.departmentId ?? undefined,
          processId: cls.processId ?? undefined,
          sections: this.toTemplateSections(parsed.sections),
        },
        actor,
      );
      await this.templates.publish(tpl.id, actor).catch((e) => this.logger.warn(`template publish failed: ${String(e)}`));
      return { id: tpl.id, type: 'audit_template', auditAction: 'import.item.template_created' };
    }
    return this.createDocument(item, parsed, cls, buffer, actor);
  }

  private async createDocument(item: ItemRow, parsed: ParsedDocument, cls: ImportClassification, buffer: Buffer | null, actor: ActorContext): Promise<{ id: string; type: string; auditAction: string }> {
    if (!cls.departmentId || !cls.categoryId) {
      throw new BadRequestException('Cannot approve without a department and category — set reviewer overrides.');
    }
    // If a document with this code already exists, add a new version rather than failing the unique constraint.
    const existing = parsed.code ? await this.prisma.controlledDocument.findFirst({ where: { code: parsed.code, deletedAt: null } }) : null;
    const code = parsed.code ?? (await this.syntheticCode());

    // Fold extracted text into description + keywords so the FTS trigger indexes the body.
    const description = this.joinDescription(parsed, item);
    const keywords = parsed.keywords ?? [];

    if (existing) {
      if (!buffer) throw new BadRequestException('Original file missing');
      await this.addVersion(existing.id, item, buffer, parsed, actor);
      return { id: existing.id, type: 'controlled_document', auditAction: 'import.item.version_added' };
    }

    const doc = await this.documents.create(
      {
        title: parsed.title || item.fileName,
        code,
        description,
        departmentId: cls.departmentId,
        categoryId: cls.categoryId,
        processId: cls.processId ?? undefined,
        keywords,
        confidentiality: 'INTERNAL',
        effectiveDate: (parsed.metadata?.effectiveDate as string | undefined) ?? undefined,
      },
      actor,
    );

    if (buffer) {
      await this.versions.create(
        doc.id,
        { originalname: item.fileName, buffer, mimetype: item.mimeType ?? 'application/octet-stream', size: buffer.length },
        { version: parsed.revision ? `v${parsed.revision}` : '1.0', comment: this.traceabilityComment(item) },
        actor,
      );
    }

    await this.timeline.record({
      processId: cls.processId,
      eventType: 'import.document_created',
      title: `${doc.code} imported from ${item.originalPath}`,
      entityType: 'document',
      entityId: doc.id,
      actorId: actor.actorId,
    });

    return { id: doc.id, type: 'controlled_document', auditAction: 'import.item.document_created' };
  }

  private async addVersion(docId: string, item: ItemRow, buffer: Buffer, parsed: ParsedDocument, actor: ActorContext): Promise<void> {
    const latest = await this.prisma.documentVersion.findFirst({ where: { documentId: docId }, orderBy: { revision: 'desc' } });
    const version = parsed.revision ? `v${parsed.revision}` : `v${(latest?.revision ?? 0) + 1}`;
    await this.versions.create(
      docId,
      { originalname: item.fileName, buffer, mimetype: item.mimeType ?? 'application/octet-stream', size: buffer.length },
      { version, comment: this.traceabilityComment(item) },
      actor,
    );
    // Augment the document's search keywords/description with the new revision's text (published versions stay immutable).
    await this.prisma.controlledDocument.update({
      where: { id: docId },
      data: { keywords: { push: parsed.keywords ?? [] } },
    }).catch(() => undefined);
  }

  private async mergeMetadata(item: ItemRow, parsed: ParsedDocument, actor: ActorContext): Promise<void> {
    const docId = item.duplicateOfId;
    if (!docId) throw new BadRequestException('No existing document to merge into');
    await this.prisma.controlledDocument.update({
      where: { id: docId },
      data: { keywords: { push: parsed.keywords ?? [] } },
    }).catch(() => undefined);
    await this.auditLog.record({ actorId: actor.actorId, action: 'import.item.merged', entityType: 'document', entityId: docId, metadata: { source: item.originalPath } });
  }

  // ------------------------------------------------------------- helpers
  private async commit(itemId: string, data: Prisma.ImportItemUncheckedUpdateInput, actor: ActorContext, auditAction: string): Promise<{ id: string; status: string; importedEntityId: string | null }> {
    const updated = await this.prisma.importItem.update({ where: { id: itemId }, data });
    await this.auditLog.record({ actorId: actor.actorId, action: auditAction, entityType: 'import_item', entityId: itemId, metadata: { jobId: updated.jobId, entity: updated.importedEntityId } });
    await this.jobs.syncCounters(updated.jobId);
    // Finalize the job when nothing is left to review.
    const pending = await this.prisma.importItem.count({ where: { jobId: updated.jobId, status: 'AWAITING_REVIEW' } });
    if (pending === 0 && !['IMPORTING', 'COMPLETED', 'CANCELLED', 'FAILED'].includes((await this.prisma.importJob.findUnique({ where: { id: updated.jobId }, select: { status: true } }))?.status ?? '')) {
      await this.jobs.finalize(updated.jobId, actor).catch((e) => this.logger.warn(`finalize failed: ${String(e)}`));
    }
    return { id: updated.id, status: updated.status, importedEntityId: updated.importedEntityId };
  }

  private async applyOverrides(cls: ImportClassification | null, overrides?: ReviewOverridesDto): Promise<ImportClassification> {
    const base: ImportClassification = cls ?? {
      departmentCode: null, departmentId: null, processCode: null, processId: null,
      categoryCode: null, categoryId: null, documentType: null, confidence: 0, signals: [],
    };
    if (!overrides) return base;
    const merged = { ...base, signals: [...base.signals] };
    if (overrides.departmentCode) {
      merged.departmentCode = overrides.departmentCode;
      merged.departmentId = await this.classification.resolveDepartmentId(overrides.departmentCode);
    }
    if (overrides.categoryCode) {
      merged.categoryCode = overrides.categoryCode;
      merged.categoryId = await this.classification.resolveCategoryId(overrides.categoryCode);
    }
    return merged;
  }

  private toParsed(item: ItemRow): ParsedDocument {
    const meta = (item.parsedMetadata as Record<string, unknown> | null) ?? {};
    const sections = (meta.sections as ParsedTemplateSection[] | undefined) ?? (this.embeddedSections(item));
    return {
      title: (meta.title as string | undefined) ?? item.fileName,
      code: meta.code as string | undefined,
      revision: meta.revision as string | undefined,
      author: meta.author as string | undefined,
      description: (item.contentText ?? '').slice(0, 280) || undefined,
      content: item.contentText ?? '',
      keywords: (meta.keywords as string[] | undefined) ?? [],
      workbookPurpose: meta.workbookPurpose as string | undefined,
      pageCount: meta.pageCount as number | undefined,
      tableCount: meta.tableCount as number | undefined,
      imageCount: meta.imageCount as number | undefined,
      ocrNeeded: (meta.ocrNeeded as boolean | undefined) ?? false,
      headings: meta.headings as string[] | undefined,
      sections,
      metadata: { ...meta, effectiveDate: meta.effectiveDate },
    };
  }

  /** Sections may have been stored under parsedMetadata.sections by the Excel parser. */
  private embeddedSections(item: ItemRow): ParsedTemplateSection[] | undefined {
    const s = (item.parsedMetadata as { sections?: ParsedTemplateSection[] } | null)?.sections;
    return s && s.length ? s : undefined;
  }

  private toTemplateSections(sections: ParsedTemplateSection[]): { title: string; order: number; questions: { text: string; type: QuestionType; required: boolean; weight: number; evidenceRequired: boolean; findingRequired: boolean }[] }[] {
    return sections.map((s, i) => ({
      title: s.title,
      order: i,
      questions: s.questions.map((q) => ({
        text: q.text,
        type: (q.type ?? 'YES_NO') as QuestionType,
        required: q.required ?? false,
        weight: q.weight ?? 1,
        evidenceRequired: q.evidenceRequired ?? false,
        findingRequired: q.findingRequired ?? false,
      })),
    }));
  }

  private joinDescription(parsed: ParsedDocument, item: ItemRow): string {
    const excerpt = (parsed.content ?? '').replace(/\s+/g, ' ').trim().slice(0, 500);
    return excerpt ? `${parsed.description ?? parsed.title} — ${excerpt}` : `${parsed.description ?? `Imported from ${item.originalPath}`}`;
  }

  private traceabilityComment(item: ItemRow): string {
    return `Imported via legacy QMS import — original path: ${item.originalPath}`;
  }

  private async syntheticCode(): Promise<string> {
    const n = await this.prisma.controlledDocument.count();
    return `IMP-${String(n + 1).padStart(4, '0')}`;
  }
}

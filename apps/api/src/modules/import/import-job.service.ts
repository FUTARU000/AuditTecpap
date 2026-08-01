import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma, type ImportItemStatus, type ImportJobStatus, type ImportSource } from '@prisma/client';
import type { ImportFormat } from '@tecpap/config';
import type {
  ImportClassification,
  ImportItemDto,
  ImportItemStatus as DtoItemStatus,
  ImportJobDto,
  ImportJobDetailDto,
  PaginatedResult,
} from '@tecpap/types';
import { parsePagination, paginated } from '../../common/pagination/pagination';
import type { ActorContext } from '../../common/context/actor';
import type { DataScope } from '../../common/types/data-scope';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import { ParserRegistry } from './parser.registry';
import { ImportScanner, checksum, formatOf } from './import-scanner';
import { MetadataExtractor } from './metadata-extractor';
import { ClassificationEngine } from './classification.engine';
import { DuplicateDetector } from './duplicate.detector';
import { ImportStatisticsService } from './import-statistics.service';
import { RelationshipResolver } from './relationship.resolver';
import type { ImportFileInput, ParsedDocument } from './interfaces/document-parser.interface';

export interface UploadFile {
  name: string;
  buffer: Buffer;
  mimeType: string;
  originalPath?: string;
}

const MAX_CONTENT_STORED = 100_000;

/** Maps the DB rows to transport DTOs. */
@Injectable()
export class ImportJobService {
  private readonly logger = new Logger(ImportJobService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ParserRegistry,
    private readonly scanner: ImportScanner,
    private readonly metadata: MetadataExtractor,
    private readonly classification: ClassificationEngine,
    private readonly duplicates: DuplicateDetector,
    private readonly stats: ImportStatisticsService,
    private readonly storage: StorageService,
    private readonly auditLog: AuditLogService,
    private readonly timeline: ActivityTimelineService,
    private readonly relationships: RelationshipResolver,
  ) {}

  // ---------------------------------------------------------------- create
  async create(actor: ActorContext, input: { source: ImportSource; sourceLocation?: string; name?: string }): Promise<ImportJobDto> {
    const job = await this.prisma.importJob.create({
      data: {
        source: input.source,
        sourceLocation: input.sourceLocation ?? null,
        name: input.name ?? null,
        status: 'PENDING',
        startedById: actor.actorId!,
      },
      include: { startedBy: { select: { firstName: true, lastName: true } } },
    });
    await this.audit(actor, 'import.job.created', job.id, { source: input.source });
    return this.toJobDto(job);
  }

  // ------------------------------------------------------ scan (LOCAL/DRIVE)
  async runScan(actor: ActorContext, source: ImportSource, location: string, name?: string): Promise<ImportJobDetailDto> {
    const dto = await this.create(actor, { source, sourceLocation: location, name });
    const files = await this.scanner.scan(source, location);
    const uploadFiles: UploadFile[] = await Promise.all(
      files.map(async (f) => ({ name: f.fileName, buffer: await f.read(), mimeType: f.mimeType, originalPath: f.originalPath })),
    );
    return this.processUpload(dto.id, uploadFiles, actor);
  }

  // ------------------------------------------------------ upload (in-memory)
  async runUpload(actor: ActorContext, files: UploadFile[], name?: string): Promise<ImportJobDetailDto> {
    const dto = await this.create(actor, { source: 'UPLOAD', name });
    return this.processUpload(dto.id, files, actor);
  }

  // --------------------------------------------------- the parse/classify core
  async processUpload(jobId: string, files: UploadFile[], actor: ActorContext): Promise<ImportJobDetailDto> {
    const total = files.length;
    await this.prisma.importJob.update({ where: { id: jobId }, data: { status: 'SCANNING' } });

    let processed = 0;
    for (const file of files) {
      processed++;
      try {
        await this.processOne(jobId, file, actor);
      } catch (error) {
        await this.recordFailure(jobId, file, error);
      }
      await this.prisma.importJob.update({
        where: { id: jobId },
        data: { status: processed < total ? 'PARSING' : 'CLASSIFYING', processed, progress: Math.round((processed / total) * 100) },
      });
    }

    await this.syncCounters(jobId);
    await this.finalizeState(jobId, actor);
    return this.detail(jobId);
  }

  private async processOne(jobId: string, file: UploadFile, actor: ActorContext): Promise<void> {
    const ext = (file.name.split('.').pop() ?? '').toLowerCase();
    const format = formatOf(ext);
    const cs = checksum(file.buffer);
    const fileKey = `imports/${jobId}/${randomUUID()}-${file.name}`;
    await this.storage.putObject(fileKey, file.buffer, file.mimeType);

    if (!format) {
      await this.prisma.importItem.create({
        data: {
          jobId, originalPath: file.originalPath ?? file.name, relativePath: file.originalPath ?? null,
          fileName: file.name, extension: ext, mimeType: file.mimeType, sizeBytes: file.buffer.length,
          checksum: cs, parentFolder: this.parentOf(file.originalPath), format: ext.toLowerCase(), fileKey,
          status: 'SKIPPED', error: 'Unsupported file type',
        },
      });
      return;
    }

    const input: ImportFileInput = { name: file.name, originalPath: file.originalPath, buffer: file.buffer, mimeType: file.mimeType, size: file.buffer.length };
    const parser = this.registry.findByFile(input);
    if (!parser) throw new Error(`No parser for .${ext}`);

    const parsed = await parser.parse(input);
    const meta = this.metadata.extract(parsed);
    const cls = await this.classification.classify(parsed, { path: file.originalPath ?? file.name, fileName: file.name, format: format as ImportFormat });
    const dup = await this.duplicates.detect(cs, parsed.code ?? null);
    const targetEntityType = parsed.workbookPurpose === 'AUDIT_CHECKLIST' && parsed.sections && parsed.sections.length > 0 ? 'AUDIT_TEMPLATE' : 'CONTROLLED_DOCUMENT';
    const warnings = this.collectWarnings(parsed, cls);

    const status: ImportItemStatus = dup.checksumDuplicateDocId ? 'DUPLICATE' : 'AWAITING_REVIEW';

    await this.prisma.importItem.create({
      data: {
        jobId, originalPath: file.originalPath ?? file.name, relativePath: file.originalPath ?? null,
        fileName: file.name, extension: ext, mimeType: file.mimeType, sizeBytes: file.buffer.length,
        checksum: cs, parentFolder: this.parentOf(file.originalPath), format, fileKey, status,
        parsedMetadata: meta.metadata as unknown as Prisma.InputJsonValue,
        contentText: (parsed.content ?? '').slice(0, MAX_CONTENT_STORED),
        pageCount: parsed.pageCount, tableCount: parsed.tableCount, imageCount: parsed.imageCount,
        ocrNeeded: parsed.ocrNeeded ?? false,
        warnings: warnings.length ? (warnings as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        detectedType: parsed.workbookPurpose ?? cls.documentType,
        targetEntityType,
        classification: cls as unknown as Prisma.InputJsonValue,
        duplicateOfId: dup.checksumDuplicateDocId ?? dup.codeConflictDocId,
        duplicateStrategy: dup.checksumDuplicateDocId ? 'SKIP' : dup.codeConflictDocId ? 'REPLACE_VERSION' : null,
      },
    });

    await this.timeline.record({
      processId: cls.processId,
      eventType: dup.checksumDuplicateDocId ? 'import.duplicate_detected' : 'import.file_classified',
      title: `${file.name} → ${cls.documentType ?? format} (${Math.round(cls.confidence * 100)}%)`,
      entityType: 'import_item',
      actorId: actor.actorId,
    });
  }

  private collectWarnings(parsed: ParsedDocument, cls: ImportClassification): string[] {
    const w: string[] = [];
    if (parsed.ocrNeeded) w.push('No extractable text — OCR required');
    if (!cls.departmentId) w.push('Department could not be inferred');
    if (!cls.categoryId) w.push('Category could not be inferred');
    return w;
  }

  private parentOf(path?: string): string | null {
    if (!path) return null;
    const idx = path.lastIndexOf('/');
    return idx > 0 ? path.slice(0, idx) : null;
  }

  private async recordFailure(jobId: string, file: UploadFile, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.warn(`Failed to import ${file.name}: ${message}`);
    await this.prisma.importItem.create({
      data: {
        jobId, originalPath: file.originalPath ?? file.name, relativePath: file.originalPath ?? null,
        fileName: file.name, extension: file.name.split('.').pop() ?? '', mimeType: file.mimeType,
        sizeBytes: file.buffer.length, checksum: checksum(file.buffer), parentFolder: this.parentOf(file.originalPath),
        format: (formatOf(file.name.split('.').pop() ?? '') ?? file.name.split('.').pop() ?? '').toLowerCase(),
        status: 'FAILED', error: message,
      },
    }).catch(() => undefined);
  }

  // ------------------------------------------------------- counters / state
  async syncCounters(jobId: string): Promise<void> {
    const grouped = await this.prisma.importItem.groupBy({ by: ['status'], where: { jobId }, _count: true });
    const c: Record<string, number> = { IMPORTED: 0, DUPLICATE: 0, FAILED: 0, SKIPPED: 0, AWAITING_REVIEW: 0, APPROVED: 0, REJECTED: 0 };
    for (const g of grouped) c[g.status] = g._count;
    const withWarnings = await this.prisma.importItem.findMany({ where: { jobId }, select: { warnings: true } });
    const warnings = withWarnings.filter((w) => w.warnings !== null && w.warnings !== undefined).length;
    await this.prisma.importJob.update({
      where: { id: jobId },
      data: {
        imported: c.IMPORTED, duplicates: c.DUPLICATE, failed: c.FAILED, skipped: c.SKIPPED, warnings,
      },
    });
  }

  private async finalizeState(jobId: string, actor: ActorContext): Promise<void> {
    const pending = await this.prisma.importItem.count({ where: { jobId, status: 'AWAITING_REVIEW' } });
    const jobStatus = pending > 0 ? 'WAITING_REVIEW' : 'IMPORTING';
    await this.prisma.importJob.update({ where: { id: jobId }, data: { status: jobStatus } });
    await this.audit(actor, 'import.job.awaiting_review', jobId, { pending });
    // If nothing is awaiting review (e.g. only duplicates/skips), finalize immediately.
    if (pending === 0) await this.finalize(jobId, actor).catch((e) => this.logger.error(`finalize failed: ${String(e)}`));
  }

  /** Compute final stats, infer relationships, mark the job COMPLETED. */
  async finalize(jobId: string, actor: ActorContext): Promise<void> {
    const items = await this.prisma.importItem.findMany({
      where: { jobId, status: 'IMPORTED', importedEntityId: { not: null } },
      select: { importedEntityId: true, classification: true },
    });
    if (items.length) {
      // Resolve relationships among the freshly materialized documents.
      const docs = await this.prisma.controlledDocument.findMany({
        where: { id: { in: items.map((i) => i.importedEntityId!) } },
        select: { id: true, title: true },
      });
      await this.relationships.resolve(docs, actor);
    }
    const computed = await this.stats.jobStats(jobId);
    await this.prisma.importJob.update({
      where: { id: jobId },
      data: { status: 'COMPLETED', completedAt: new Date(), progress: 100, stats: computed as unknown as Prisma.InputJsonValue },
    });
    await this.audit(actor, 'import.job.completed', jobId);
  }

  // --------------------------------------------------------------- retry
  async retry(jobId: string, actor: ActorContext): Promise<ImportJobDetailDto> {
    const failed = await this.prisma.importItem.findMany({ where: { jobId, status: 'FAILED' }, select: { id: true, fileKey: true, fileName: true, originalPath: true, mimeType: true } });
    if (failed.length === 0) return this.detail(jobId);
    await this.prisma.importJob.update({ where: { id: jobId }, data: { status: 'PARSING' } });
    const files: UploadFile[] = [];
    for (const f of failed) {
      if (!f.fileKey) continue;
      files.push({ name: f.fileName, buffer: await this.storage.getObject(f.fileKey), mimeType: f.mimeType ?? 'application/octet-stream', originalPath: f.originalPath ?? undefined });
      await this.prisma.importItem.delete({ where: { id: f.id } });
    }
    if (files.length) await this.processUpload(jobId, files, actor);
    else await this.finalizeState(jobId, actor);
    return this.detail(jobId);
  }

  // -------------------------------------------------------------- cancel
  async cancel(jobId: string, actor: ActorContext): Promise<ImportJobDto> {
    const job = await this.prisma.importJob.update({ where: { id: jobId }, data: { status: 'CANCELLED', cancelledAt: new Date() }, include: { startedBy: { select: { firstName: true, lastName: true } } } });
    await this.audit(actor, 'import.job.cancelled', jobId);
    return this.toJobDto(job);
  }

  async remove(jobId: string, actor: ActorContext): Promise<void> {
    await this.prisma.importJob.delete({ where: { id: jobId } });
    await this.audit(actor, 'import.job.deleted', jobId);
  }

  // --------------------------------------------------------------- reads
  async list(scope: DataScope | undefined, actorId: string, query: { page?: number; pageSize?: number; status?: string }): Promise<PaginatedResult<ImportJobDto>> {
    const { skip, take, page, pageSize } = parsePagination(query);
    const where: Prisma.ImportJobWhereInput = {
      ...(query.status ? { status: query.status as ImportJobStatus } : {}),
      ...(this.stats.jobWhere(scope, actorId) as Prisma.ImportJobWhereInput),
    };
    const [rows, total] = await Promise.all([
      this.prisma.importJob.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: { startedBy: { select: { firstName: true, lastName: true } } } }),
      this.prisma.importJob.count({ where }),
    ]);
    return paginated(rows.map((r) => this.toJobDto(r)), total, page, pageSize);
  }

  async detail(jobId: string, scope?: DataScope, actorId?: string): Promise<ImportJobDetailDto> {
    const job = await this.prisma.importJob.findUnique({
      where: { id: jobId },
      include: { startedBy: { select: { firstName: true, lastName: true } }, items: { orderBy: { createdAt: 'asc' } } },
    });
    if (!job) throw new NotFoundException('Import job not found');
    // Department isolation: non-global viewers who did not start the job only see their department's items.
    const scopedItems = scope && !scope.isGlobal && actorId && job.startedById !== actorId
      ? job.items.filter((i) => (i.classification as { departmentId?: string } | null)?.departmentId === scope.departmentId)
      : job.items;
    const dto = this.toJobDto(job);
    return {
      ...dto,
      errors: job.errors as unknown as { fileName: string; message: string }[] | null,
      stats: job.stats as unknown as ImportJobDetailDto['stats'],
      items: scopedItems.map((i) => this.toItemDto(i)),
    };
  }

  async progress(jobId: string): Promise<{ id: string; status: string; progress: number; processed: number; imported: number; failed: number; duplicates: number }> {
    const j = await this.prisma.importJob.findUnique({ where: { id: jobId }, select: { id: true, status: true, progress: true, processed: true, imported: true, failed: true, duplicates: true } });
    if (!j) throw new NotFoundException('Import job not found');
    return j;
  }

  async itemFileKey(itemId: string): Promise<string> {
    const item = await this.prisma.importItem.findUnique({ where: { id: itemId }, select: { fileKey: true } });
    if (!item?.fileKey) throw new NotFoundException('Original file not stored for this item');
    return item.fileKey;
  }

  // ------------------------------------------------------------- mappers
  private fullName(u: { firstName: string; lastName: string } | null): string | null {
    return u ? `${u.firstName} ${u.lastName}` : null;
  }

  toJobDto(job: Prisma.ImportJobGetPayload<{ include: { startedBy: { select: { firstName: true; lastName: true } } } }>): ImportJobDto {
    return {
      id: job.id, source: job.source, sourceLocation: job.sourceLocation, name: job.name, status: job.status,
      startedById: job.startedById, startedByName: this.fullName(job.startedBy),
      progress: job.progress, processed: job.processed, imported: job.imported, skipped: job.skipped,
      failed: job.failed, duplicates: job.duplicates, warnings: job.warnings, errorMessage: job.errorMessage,
      createdAt: job.createdAt.toISOString(), updatedAt: job.updatedAt.toISOString(),
      completedAt: job.completedAt?.toISOString() ?? null, cancelledAt: job.cancelledAt?.toISOString() ?? null,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  toItemDto(item: Prisma.ImportItemGetPayload<{}>): ImportItemDto {
    return {
      id: item.id, jobId: item.jobId, originalPath: item.originalPath, relativePath: item.relativePath,
      fileName: item.fileName, extension: item.extension, mimeType: item.mimeType, sizeBytes: item.sizeBytes,
      checksum: item.checksum, parentFolder: item.parentFolder, format: item.format,
      status: item.status as DtoItemStatus, detectedType: item.detectedType, targetEntityType: item.targetEntityType,
      classification: (item.classification as ImportClassification | null) ?? null,
      parsedMetadata: (item.parsedMetadata as unknown as Record<string, unknown> | null) ?? null,
      contentExcerpt: (item.contentText ?? '').slice(0, 280) || null,
      pageCount: item.pageCount, tableCount: item.tableCount, imageCount: item.imageCount, ocrNeeded: item.ocrNeeded,
      warnings: (item.warnings as unknown as string[] | null) ?? null, error: item.error,
      duplicateOfId: item.duplicateOfId, duplicateStrategy: item.duplicateStrategy as ImportItemDto['duplicateStrategy'],
      reviewDecision: item.reviewDecision, reviewNote: item.reviewNote, reviewedById: item.reviewById,
      reviewedAt: item.reviewedAt?.toISOString() ?? null, fileKey: item.fileKey,
      importedEntityId: item.importedEntityId, importedEntityType: item.importedEntityType,
      importedAt: item.importedAt?.toISOString() ?? null, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString(),
    };
  }

  private async audit(actor: ActorContext, action: string, entityId: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.auditLog.record({ actorId: actor.actorId, action, entityType: 'import_job', entityId, metadata: metadata ?? null });
  }
}

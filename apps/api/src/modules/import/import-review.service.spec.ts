import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { StorageService } from '../storage/storage.service';
import type { DocumentsService } from '../documents/documents.service';
import type { DocumentVersionsService } from '../documents/document-versions.service';
import type { AuditTemplatesService } from '../audit-templates/audit-templates.service';
import type { AuditLogService } from '../audit-log/audit-log.service';
import type { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import type { ClassificationEngine } from './classification.engine';
import type { ImportJobService } from './import-job.service';
import { ImportReviewService } from './import-review.service';

const ACTOR = { actorId: 'u1', ipAddress: null, userAgent: null };

function baseItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1', jobId: 'job-1', status: 'AWAITING_REVIEW',
    originalPath: 'Production/PROC-014.docx', fileName: 'PROC-014.docx', extension: 'docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileKey: null, targetEntityType: 'CONTROLLED_DOCUMENT',
    parsedMetadata: { title: 'Line Procedure' }, contentText: 'body text',
    classification: { departmentCode: 'PROD', departmentId: 'd-prod', processCode: null, processId: null, categoryCode: 'PROCEDURE', categoryId: 'c-proc', documentType: 'Procedure', confidence: 0.95, signals: [] },
    duplicateOfId: null, duplicateStrategy: null,
    ...overrides,
  };
}

function build() {
  const prisma = {
    importItem: { findUnique: vi.fn(), update: vi.fn().mockResolvedValue({ id: 'item-1', jobId: 'job-1', status: 'IMPORTED', importedEntityId: 'doc-1' }), count: vi.fn().mockResolvedValue(0) },
    importJob: { findUnique: vi.fn().mockResolvedValue({ status: 'WAITING_REVIEW' }) },
    controlledDocument: { findFirst: vi.fn().mockResolvedValue(null), count: vi.fn().mockResolvedValue(0), update: vi.fn().mockResolvedValue(undefined) },
    documentVersion: { findFirst: vi.fn().mockResolvedValue(null) },
  };
  const storage = { getObject: vi.fn().mockResolvedValue(Buffer.from('bytes')) } as unknown as StorageService;
  const documents = { create: vi.fn().mockResolvedValue({ id: 'doc-1', code: 'IMP-0001' }) } as unknown as DocumentsService;
  const versions = { create: vi.fn().mockResolvedValue(undefined) } as unknown as DocumentVersionsService;
  const templates = { create: vi.fn(), publish: vi.fn() } as unknown as AuditTemplatesService;
  const classification = { resolveDepartmentId: vi.fn(), resolveCategoryId: vi.fn() } as unknown as ClassificationEngine;
  const auditLog = { record: vi.fn().mockResolvedValue(undefined) } as unknown as AuditLogService;
  const timeline = { record: vi.fn().mockResolvedValue(undefined) } as unknown as ActivityTimelineService;
  const jobs = { syncCounters: vi.fn().mockResolvedValue(undefined), finalize: vi.fn().mockResolvedValue(undefined) } as unknown as ImportJobService;

  const service = new ImportReviewService(
    prisma as unknown as PrismaService, storage, documents, versions, templates, classification, auditLog, timeline, jobs,
  );
  return { service, prisma, storage, documents, versions, classification };
}

describe('ImportReviewService — review/materialization unchanged by Google Drive integration (15)', () => {
  it('REJECT marks the item rejected without ever creating a document', async () => {
    const { service, prisma, documents } = build();
    prisma.importItem.findUnique.mockResolvedValue(baseItem());
    await service.review('item-1', 'REJECT', ACTOR);
    expect(documents.create).not.toHaveBeenCalled();
    expect(prisma.importItem.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'REJECTED', reviewDecision: 'REJECT' }) }));
  });

  it('APPROVE refuses to materialize a document without a resolved department and category (Drive items are not exempt)', async () => {
    const { service, prisma } = build();
    prisma.importItem.findUnique.mockResolvedValue(baseItem({
      classification: { departmentCode: null, departmentId: null, processCode: null, processId: null, categoryCode: null, categoryId: null, documentType: null, confidence: 0.2, signals: [] },
    }));
    await expect(service.review('item-1', 'APPROVE', ACTOR)).rejects.toThrow(BadRequestException);
  });

  it('APPROVE with a resolved department + category creates a ControlledDocument (Drive-sourced items follow the identical path)', async () => {
    const { service, prisma, documents } = build();
    prisma.importItem.findUnique.mockResolvedValue(baseItem());
    const result = await service.review('item-1', 'APPROVE', ACTOR);
    expect(documents.create).toHaveBeenCalledWith(expect.objectContaining({ departmentId: 'd-prod', categoryId: 'c-proc' }), ACTOR);
    expect(result.importedEntityId).toBe('doc-1');
  });

  it('reviewer department/category overrides still resolve through the unchanged ClassificationEngine', async () => {
    const { service, prisma, classification } = build();
    (classification.resolveDepartmentId as ReturnType<typeof vi.fn>).mockResolvedValue('d-hyg');
    (classification.resolveCategoryId as ReturnType<typeof vi.fn>).mockResolvedValue('c-proc');
    prisma.importItem.findUnique.mockResolvedValue(baseItem({
      classification: { departmentCode: null, departmentId: null, processCode: null, processId: null, categoryCode: null, categoryId: null, documentType: null, confidence: 0.2, signals: [] },
    }));
    await service.review('item-1', 'APPROVE', ACTOR, { departmentCode: 'HYG', categoryCode: 'PROCEDURE' });
    expect(classification.resolveDepartmentId).toHaveBeenCalledWith('HYG');
    expect(classification.resolveCategoryId).toHaveBeenCalledWith('PROCEDURE');
  });
});

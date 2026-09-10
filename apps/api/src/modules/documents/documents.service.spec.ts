import { ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditLogService } from '../audit-log/audit-log.service';
import type { PrismaService } from '../prisma/prisma.service';
import { DocumentsService } from './documents.service';

const ACTOR = { actorId: 'u1', ipAddress: null, userAgent: null };

describe('DocumentsService', () => {
  type MockFn = ReturnType<typeof vi.fn>;
  let service: DocumentsService;
  let prisma: {
    controlledDocument: { findFirst: MockFn; findMany: MockFn; count: MockFn; create: MockFn; update: MockFn; groupBy: MockFn };
    department: { findUnique: MockFn; findMany: MockFn };
    documentCategory: { findUnique: MockFn; findMany: MockFn };
    process: { findFirst: MockFn; findMany: MockFn };
    user: { findUnique: MockFn; findMany: MockFn };
    $queryRawUnsafe: MockFn;
  };

  beforeEach(() => {
    prisma = {
      controlledDocument: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), groupBy: vi.fn() },
      department: { findUnique: vi.fn(), findMany: vi.fn() },
      documentCategory: { findUnique: vi.fn(), findMany: vi.fn() },
      process: { findFirst: vi.fn(), findMany: vi.fn() },
      user: { findUnique: vi.fn(), findMany: vi.fn() },
      $queryRawUnsafe: vi.fn(),
    };
    service = new DocumentsService(prisma as unknown as PrismaService, { record: vi.fn() } as unknown as AuditLogService, { emit: vi.fn().mockResolvedValue(null) } as never);
  });

  it('creates a document and audits it', async () => {
    prisma.department.findUnique.mockResolvedValue({ id: 'd1' });
    prisma.documentCategory.findUnique.mockResolvedValue({ id: 'c1' });
    prisma.user.findUnique.mockResolvedValue({ role: { isGlobal: false } });
    prisma.controlledDocument.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({
        ...data, id: 'doc1', currentVersionId: null, version: '0.1', revision: 0, status: data.status ?? 'DRAFT',
        keywords: [], confidentiality: 'INTERNAL', effectiveDate: null, reviewDate: null, expirationDate: null,
        updatedById: null, createdAt: new Date(0), updatedAt: new Date(0),
        department: { name: 'Production' }, process: null, category: { name: 'Procedure', color: '#000' },
        owner: null, reviewer: null, approver: null, currentVersion: null,
      }),
    );

    const doc = await service.create({ title: 'SOP', code: 'DOC-1', departmentId: 'd1', categoryId: 'c1' }, ACTOR);
    expect(doc.id).toBe('doc1');
    expect(doc.status).toBe('DRAFT');
    expect(prisma.controlledDocument.create).toHaveBeenCalledTimes(1);
  });

  it('creates a document as APPROVED when uploader is a global-role user (Audit Manager)', async () => {
    prisma.department.findUnique.mockResolvedValue({ id: 'd1' });
    prisma.documentCategory.findUnique.mockResolvedValue({ id: 'c1' });
    prisma.user.findUnique.mockResolvedValue({ role: { isGlobal: true } });
    prisma.controlledDocument.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({
        ...data, id: 'doc2', currentVersionId: null, version: '0.1', revision: 0, status: data.status ?? 'DRAFT',
        keywords: [], confidentiality: 'INTERNAL', effectiveDate: null, reviewDate: null, expirationDate: null,
        updatedById: null, createdAt: new Date(0), updatedAt: new Date(0),
        department: { name: 'Production' }, process: null, category: { name: 'Procedure', color: '#000' },
        owner: null, reviewer: null, approver: null, currentVersion: null,
      }),
    );

    const doc = await service.create({ title: 'SOP', code: 'DOC-2', departmentId: 'd1', categoryId: 'c1' }, ACTOR);
    expect(doc.status).toBe('APPROVED');
  });

  it('rejects an invalid status transition', async () => {
    prisma.controlledDocument.findFirst.mockResolvedValue({ id: 'doc1', status: 'PUBLISHED', effectiveDate: new Date() });
    // PUBLISHED can only go to OBSOLETE / UNDER_REVIEW — DRAFT is not allowed.
    await expect(service.changeStatus('doc1', 'DRAFT', ACTOR)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.controlledDocument.update).not.toHaveBeenCalled();
  });

  it('allows a valid transition', async () => {
    prisma.controlledDocument.findFirst.mockResolvedValue({ id: 'doc1', status: 'DRAFT', effectiveDate: null });
    prisma.controlledDocument.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'doc1', status: data.status, version: '0.1', revision: 0, code: 'DOC-1', title: 'SOP', description: null, departmentId: 'd1', processId: null, categoryId: 'c1', keywords: [], confidentiality: 'INTERNAL', effectiveDate: null, reviewDate: null, expirationDate: null, createdById: 'u1', updatedById: 'u1', ownerId: null, reviewerId: null, approverId: null, currentVersionId: null, deletedAt: null, createdAt: new Date(0), updatedAt: new Date(0), department: { name: 'Production' }, process: null, category: { name: 'Procedure', color: null }, owner: null, reviewer: null, approver: null, currentVersion: null }),
    );
    const updated = await service.changeStatus('doc1', 'UNDER_REVIEW', ACTOR);
    expect(updated.status).toBe('UNDER_REVIEW');
    expect(prisma.controlledDocument.update).toHaveBeenCalled();
  });

  it('short-circuits search for very short terms', async () => {
    expect(await service.search('a', undefined)).toEqual([]);
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  it('builds a Department → Process → Category tree with counts', async () => {
    prisma.controlledDocument.groupBy.mockResolvedValue([
      { departmentId: 'd1', processId: 'p1', categoryId: 'c1', _count: { _all: 3 } },
    ]);
    prisma.department.findMany.mockResolvedValue([{ id: 'd1', name: 'Production', code: 'PROD' }]);
    prisma.process.findMany.mockResolvedValue([{ id: 'p1', name: 'Molding', code: 'MOLD', departmentId: 'd1' }]);
    prisma.documentCategory.findMany.mockResolvedValue([{ id: 'c1', name: 'Procedure', code: 'PROC' }]);

    const tree = await service.tree(undefined);
    expect(tree).toHaveLength(1);
    expect(tree[0]?.type).toBe('department');
    expect(tree[0]?.children?.[0]?.children?.[0]?.count).toBe(3);
  });
});

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
    controlledDocument: {
      findFirst: MockFn;
      findMany: MockFn;
      count: MockFn;
      create: MockFn;
      update: MockFn;
      groupBy: MockFn;
    };
    department: { findUnique: MockFn; findMany: MockFn };
    documentCategory: { findUnique: MockFn; findMany: MockFn };
    process: { findFirst: MockFn; findMany: MockFn };
    user: { findUnique: MockFn; findMany: MockFn };
    $queryRawUnsafe: MockFn;
  };

  beforeEach(() => {
    prisma = {
      controlledDocument: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        groupBy: vi.fn(),
      },
      department: { findUnique: vi.fn(), findMany: vi.fn() },
      documentCategory: { findUnique: vi.fn(), findMany: vi.fn() },
      process: { findFirst: vi.fn(), findMany: vi.fn() },
      user: { findUnique: vi.fn(), findMany: vi.fn() },
      $queryRawUnsafe: vi.fn(),
    };
    service = new DocumentsService(
      prisma as unknown as PrismaService,
      { record: vi.fn() } as unknown as AuditLogService,
      { emit: vi.fn().mockResolvedValue(null) } as never,
    );
  });

  it('creates a document and audits it', async () => {
    prisma.department.findUnique.mockResolvedValue({ id: 'd1' });
    prisma.documentCategory.findUnique.mockResolvedValue({ id: 'c1' });
    prisma.user.findUnique.mockResolvedValue({ role: { isGlobal: false } });
    prisma.controlledDocument.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({
          ...data,
          id: 'doc1',
          currentVersionId: null,
          version: '0.1',
          revision: 0,
          status: data.status ?? 'DRAFT',
          keywords: [],
          confidentiality: 'INTERNAL',
          effectiveDate: null,
          reviewDate: null,
          expirationDate: null,
          updatedById: null,
          createdAt: new Date(0),
          updatedAt: new Date(0),
          department: { name: 'Production' },
          process: null,
          category: { name: 'Procedure', color: '#000' },
          owner: null,
          reviewer: null,
          approver: null,
          currentVersion: null,
        }),
    );

    const doc = await service.create(
      { title: 'SOP', code: 'DOC-1', departmentId: 'd1', categoryId: 'c1' },
      ACTOR,
    );
    expect(doc.id).toBe('doc1');
    expect(doc.status).toBe('DRAFT');
    expect(prisma.controlledDocument.create).toHaveBeenCalledTimes(1);
  });

  it('creates a document as APPROVED when uploader is a global-role user (Audit Manager)', async () => {
    prisma.department.findUnique.mockResolvedValue({ id: 'd1' });
    prisma.documentCategory.findUnique.mockResolvedValue({ id: 'c1' });
    prisma.user.findUnique.mockResolvedValue({ role: { isGlobal: true } });
    prisma.controlledDocument.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({
          ...data,
          id: 'doc2',
          currentVersionId: null,
          version: '0.1',
          revision: 0,
          status: data.status ?? 'DRAFT',
          keywords: [],
          confidentiality: 'INTERNAL',
          effectiveDate: null,
          reviewDate: null,
          expirationDate: null,
          updatedById: null,
          createdAt: new Date(0),
          updatedAt: new Date(0),
          department: { name: 'Production' },
          process: null,
          category: { name: 'Procedure', color: '#000' },
          owner: null,
          reviewer: null,
          approver: null,
          currentVersion: null,
        }),
    );

    const doc = await service.create(
      { title: 'SOP', code: 'DOC-2', departmentId: 'd1', categoryId: 'c1' },
      ACTOR,
    );
    expect(doc.status).toBe('APPROVED');
  });

  it('rejects an invalid status transition', async () => {
    prisma.controlledDocument.findFirst.mockResolvedValue({
      id: 'doc1',
      status: 'PUBLISHED',
      effectiveDate: new Date(),
    });
    // PUBLISHED can only go to OBSOLETE / UNDER_REVIEW — DRAFT is not allowed.
    await expect(service.changeStatus('doc1', 'DRAFT', ACTOR)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.controlledDocument.update).not.toHaveBeenCalled();
  });

  it('allows a valid transition', async () => {
    prisma.controlledDocument.findFirst.mockResolvedValue({
      id: 'doc1',
      status: 'DRAFT',
      effectiveDate: null,
    });
    prisma.controlledDocument.update.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({
          id: 'doc1',
          status: data.status,
          version: '0.1',
          revision: 0,
          code: 'DOC-1',
          title: 'SOP',
          description: null,
          departmentId: 'd1',
          processId: null,
          categoryId: 'c1',
          keywords: [],
          confidentiality: 'INTERNAL',
          effectiveDate: null,
          reviewDate: null,
          expirationDate: null,
          createdById: 'u1',
          updatedById: 'u1',
          ownerId: null,
          reviewerId: null,
          approverId: null,
          currentVersionId: null,
          deletedAt: null,
          createdAt: new Date(0),
          updatedAt: new Date(0),
          department: { name: 'Production' },
          process: null,
          category: { name: 'Procedure', color: null },
          owner: null,
          reviewer: null,
          approver: null,
          currentVersion: null,
        }),
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
    prisma.process.findMany.mockResolvedValue([
      { id: 'p1', name: 'Molding', code: 'MOLD', departmentId: 'd1' },
    ]);
    prisma.documentCategory.findMany.mockResolvedValue([
      { id: 'c1', name: 'Procedure', code: 'PROC' },
    ]);

    const tree = await service.tree(undefined);
    expect(tree).toHaveLength(1);
    expect(tree[0]?.type).toBe('department');
    expect(tree[0]?.children?.[0]?.children?.[0]?.count).toBe(3);
  });

  describe('duplicate-name prevention', () => {
    it('rejects creating a document whose normalized title collides with an existing one', async () => {
      prisma.department.findUnique.mockResolvedValue({ id: 'd1' });
      prisma.documentCategory.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.controlledDocument.findFirst.mockResolvedValue({ id: 'existing-doc' });

      await expect(
        service.create(
          { title: '  Quality Manual  ', code: 'DOC-9', departmentId: 'd1', categoryId: 'c1' },
          ACTOR,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.controlledDocument.create).not.toHaveBeenCalled();
    });

    it('allows creating a document whose title normalizes differently from any existing one', async () => {
      prisma.department.findUnique.mockResolvedValue({ id: 'd1' });
      prisma.documentCategory.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.controlledDocument.findFirst.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue({ role: { isGlobal: false } });
      prisma.controlledDocument.create.mockImplementation(
        ({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({
            ...data,
            id: 'doc9',
            currentVersionId: null,
            version: '0.1',
            revision: 0,
            status: data.status ?? 'DRAFT',
            keywords: [],
            confidentiality: 'INTERNAL',
            effectiveDate: null,
            reviewDate: null,
            expirationDate: null,
            updatedById: null,
            createdAt: new Date(0),
            updatedAt: new Date(0),
            department: { name: 'Production' },
            process: null,
            category: { name: 'Procedure', color: '#000' },
            owner: null,
            reviewer: null,
            approver: null,
            currentVersion: null,
          }),
      );

      const doc = await service.create(
        { title: 'Unique Title', code: 'DOC-9', departmentId: 'd1', categoryId: 'c1' },
        ACTOR,
      );
      expect(doc.id).toBe('doc9');
    });

    it('rejects renaming a document to a title already used by another document', async () => {
      // 1st findFirst = load current record; 2nd = the uniqueness check, which finds a collision.
      prisma.controlledDocument.findFirst
        .mockResolvedValueOnce({
          id: 'doc1',
          status: 'DRAFT',
          title: 'Old Title',
          departmentId: 'd1',
          categoryId: 'c1',
          processId: null,
        })
        .mockResolvedValueOnce({ id: 'other-doc' });

      await expect(
        service.update('doc1', { title: 'Someone Else Title' }, ACTOR),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.controlledDocument.update).not.toHaveBeenCalled();
    });

    it('allows a document to keep its own title on update (excludes itself from the collision check)', async () => {
      prisma.controlledDocument.findFirst
        .mockResolvedValueOnce({
          id: 'doc1',
          status: 'DRAFT',
          title: 'Same Title',
          departmentId: 'd1',
          categoryId: 'c1',
          processId: null,
        })
        .mockResolvedValueOnce(null);
      prisma.controlledDocument.update.mockImplementation(
        ({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({
            id: 'doc1',
            status: 'DRAFT',
            version: '0.1',
            revision: 0,
            code: 'DOC-1',
            title: data.title,
            description: null,
            departmentId: 'd1',
            processId: null,
            categoryId: 'c1',
            keywords: [],
            confidentiality: 'INTERNAL',
            effectiveDate: null,
            reviewDate: null,
            expirationDate: null,
            createdById: 'u1',
            updatedById: 'u1',
            ownerId: null,
            reviewerId: null,
            approverId: null,
            currentVersionId: null,
            deletedAt: null,
            createdAt: new Date(0),
            updatedAt: new Date(0),
            department: { name: 'Production' },
            process: null,
            category: { name: 'Procedure', color: null },
            owner: null,
            reviewer: null,
            approver: null,
            currentVersion: null,
          }),
      );

      const updated = await service.update('doc1', { title: 'Same Title' }, ACTOR);
      expect(updated.title).toBe('Same Title');
    });
  });

  describe('list — smart search / combined filters', () => {
    const GLOBAL_SCOPE = { role: 'audit-manager', departmentId: null, isGlobal: true };
    const PILOT_SCOPE = { role: 'pilot', departmentId: 'dept-a', isGlobal: false };

    beforeEach(() => {
      prisma.controlledDocument.findMany.mockResolvedValue([]);
      prisma.controlledDocument.count.mockResolvedValue(0);
    });

    it('searches across title/code/keywords/description/category name/department name, not just the title', async () => {
      await service.list({ search: 'quality' } as never, GLOBAL_SCOPE);
      const where = prisma.controlledDocument.findMany.mock.calls[0]![0].where;
      const searchedFields = where.OR.map(
        (clause: Record<string, unknown>) => Object.keys(clause)[0],
      );
      expect(searchedFields).toEqual(
        expect.arrayContaining([
          'title',
          'code',
          'keywords',
          'description',
          'category',
          'department',
        ]),
      );
    });

    it('filters by department', async () => {
      await service.list({ departmentId: 'dept-x' } as never, GLOBAL_SCOPE);
      const where = prisma.controlledDocument.findMany.mock.calls[0]![0].where;
      expect(where.departmentId).toBe('dept-x');
    });

    it('filters by category', async () => {
      await service.list({ categoryId: 'cat-x' } as never, GLOBAL_SCOPE);
      const where = prisma.controlledDocument.findMany.mock.calls[0]![0].where;
      expect(where.categoryId).toBe('cat-x');
    });

    it('filters by status', async () => {
      await service.list({ status: 'PUBLISHED' } as never, GLOBAL_SCOPE);
      const where = prisma.controlledDocument.findMany.mock.calls[0]![0].where;
      expect(where.status).toBe('PUBLISHED');
    });

    it('combines search, department, category and status filters together (AND), not one replacing another', async () => {
      await service.list(
        { search: 'sop', departmentId: 'dept-x', categoryId: 'cat-x', status: 'DRAFT' } as never,
        GLOBAL_SCOPE,
      );
      const where = prisma.controlledDocument.findMany.mock.calls[0]![0].where;
      expect(where.departmentId).toBe('dept-x');
      expect(where.categoryId).toBe('cat-x');
      expect(where.status).toBe('DRAFT');
      expect(where.OR).toBeDefined();
    });

    it('forces a department-scoped Pilot to their own department, regardless of a departmentId query param for another department', async () => {
      await service.list({ departmentId: 'dept-b' } as never, PILOT_SCOPE);
      const where = prisma.controlledDocument.findMany.mock.calls[0]![0].where;
      expect(where.departmentId).toBe('dept-a'); // scope wins over the requested query param
    });
  });
});

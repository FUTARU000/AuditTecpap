import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DataScope } from '../../common/types/data-scope';
import type { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import type { AuditLogService } from '../audit-log/audit-log.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { StorageService } from '../storage/storage.service';
import { CapaActionsService } from './capa-actions.service';

const ACTOR = { actorId: 'pilot-a', ipAddress: null, userAgent: null };
const pilotDeptA: DataScope = { role: 'pilot', departmentId: 'dept-a', isGlobal: false };
const managerGlobal: DataScope = { role: 'audit-manager', departmentId: null, isGlobal: true };

const ACTION_ROW = {
  id: 'act-1', capaId: 'capa-b', title: 'x', description: null, actionType: 'CORRECTIVE' as const,
  ownerId: null, owner: null, priority: 'MEDIUM' as const, status: 'OPEN' as const, dueDate: null,
  completedAt: null, completionComment: null, createdAt: new Date(0), updatedAt: new Date(0), _count: { evidence: 0 },
};

/**
 * Regression coverage for the department-scope / IDOR fix: CAPA action
 * list/create/update/remove/evidence access must be scoped through the
 * parent CAPA's department.
 */
describe('CapaActionsService — department isolation', () => {
  type MockFn = ReturnType<typeof vi.fn>;
  let service: CapaActionsService;
  let prisma: {
    capa: { findFirst: MockFn };
    capaAction: { findMany: MockFn; findUnique: MockFn; create: MockFn; update: MockFn; delete: MockFn };
    capaActionEvidence: { findFirst: MockFn; create: MockFn };
  };
  let storage: { presignedDownloadUrl: MockFn; putObject: MockFn };

  beforeEach(() => {
    prisma = {
      capa: { findFirst: vi.fn() },
      capaAction: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
      capaActionEvidence: { findFirst: vi.fn(), create: vi.fn() },
    };
    storage = { presignedDownloadUrl: vi.fn().mockResolvedValue('https://minio.local/signed'), putObject: vi.fn() };
    service = new CapaActionsService(
      prisma as unknown as PrismaService,
      storage as unknown as StorageService,
      { record: vi.fn() } as unknown as AuditLogService,
      { record: vi.fn() } as unknown as ActivityTimelineService,
    );
  });

  describe('list', () => {
    it('denies a Pilot listing actions for a CAPA outside their department', async () => {
      prisma.capa.findFirst.mockResolvedValue(null);
      await expect(service.list('capa-in-dept-b', pilotDeptA)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.capaAction.findMany).not.toHaveBeenCalled();
    });

    it('allows a Pilot to list actions for a CAPA in their own department', async () => {
      prisma.capa.findFirst.mockResolvedValue({ id: 'capa-1', departmentId: 'dept-a', processId: null });
      prisma.capaAction.findMany.mockResolvedValue([]);
      await expect(service.list('capa-1', pilotDeptA)).resolves.toEqual([]);
    });

    it('allows a global Audit Manager to list actions for any department', async () => {
      prisma.capa.findFirst.mockResolvedValue({ id: 'capa-in-dept-b', departmentId: 'dept-b', processId: null });
      prisma.capaAction.findMany.mockResolvedValue([]);
      await expect(service.list('capa-in-dept-b', managerGlobal)).resolves.toEqual([]);
    });
  });

  describe('create', () => {
    it('denies a Pilot creating an action against a CAPA outside their department', async () => {
      prisma.capa.findFirst.mockResolvedValue(null);
      await expect(service.create('capa-in-dept-b', { title: 'Fix it' }, ACTOR, pilotDeptA)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.capaAction.create).not.toHaveBeenCalled();
    });

    it('allows a Pilot to create an action against a CAPA in their own department', async () => {
      prisma.capa.findFirst.mockResolvedValue({ id: 'capa-1', departmentId: 'dept-a', processId: 'p1' });
      prisma.capaAction.create.mockResolvedValue({ ...ACTION_ROW, id: 'act-2', capaId: 'capa-1', title: 'Fix it' });
      const action = await service.create('capa-1', { title: 'Fix it' }, ACTOR, pilotDeptA);
      expect(action.title).toBe('Fix it');
    });
  });

  describe('update / remove / evidence', () => {
    it('denies updating an action whose CAPA belongs to another department', async () => {
      prisma.capaAction.findUnique.mockResolvedValue({ ...ACTION_ROW, capa: { departmentId: 'dept-b' } });
      await expect(service.update('act-1', { title: 'x' }, ACTOR, pilotDeptA)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.capaAction.update).not.toHaveBeenCalled();
    });

    it('denies removing an action whose CAPA belongs to another department', async () => {
      prisma.capaAction.findUnique.mockResolvedValue({ ...ACTION_ROW, capa: { departmentId: 'dept-b' } });
      await expect(service.remove('act-1', pilotDeptA)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.capaAction.delete).not.toHaveBeenCalled();
    });

    it('denies uploading evidence to an action whose CAPA belongs to another department', async () => {
      prisma.capaAction.findUnique.mockResolvedValue({ ...ACTION_ROW, capa: { processId: null, departmentId: 'dept-b' } });
      await expect(
        service.uploadEvidence('act-1', { originalname: 'f.pdf', buffer: Buffer.from('x'), mimetype: 'application/pdf', size: 1 }, null, ACTOR, pilotDeptA),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(storage.putObject).not.toHaveBeenCalled();
    });

    it('denies downloading action evidence whose CAPA belongs to another department', async () => {
      prisma.capaActionEvidence.findFirst.mockResolvedValue({ id: 'ev-1', fileKey: 'k', action: { capa: { departmentId: 'dept-b' } } });
      await expect(service.downloadUrl('act-1', 'ev-1', pilotDeptA)).rejects.toBeInstanceOf(NotFoundException);
      expect(storage.presignedDownloadUrl).not.toHaveBeenCalled();
    });

    it('allows a global Audit Manager to update an action from any department', async () => {
      prisma.capaAction.findUnique.mockResolvedValue({ ...ACTION_ROW, capa: { departmentId: 'dept-b' } });
      prisma.capaAction.update.mockResolvedValue({ ...ACTION_ROW, title: 'y' });
      await expect(service.update('act-1', { title: 'y' }, ACTOR, managerGlobal)).resolves.toMatchObject({ title: 'y' });
    });

    it('allows a Pilot to access their own department CAPA action evidence', async () => {
      prisma.capaActionEvidence.findFirst.mockResolvedValue({ id: 'ev-1', fileKey: 'k', action: { capa: { departmentId: 'dept-a' } } });
      await expect(service.downloadUrl('act-1', 'ev-1', pilotDeptA)).resolves.toEqual({ url: 'https://minio.local/signed' });
    });
  });
});

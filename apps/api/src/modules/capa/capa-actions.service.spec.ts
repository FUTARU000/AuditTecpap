import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DataScope } from '../../common/types/data-scope';
import type { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import type { AuditLogService } from '../audit-log/audit-log.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { StorageService } from '../storage/storage.service';
import type { NotificationService } from '../productivity/notification.service';
import { CapaActionsService } from './capa-actions.service';

const ACTOR = { actorId: 'pilot-a', ipAddress: null, userAgent: null };
const MANAGER_ACTOR = { actorId: 'manager-1', ipAddress: null, userAgent: null };
const pilotDeptA: DataScope = { role: 'pilot', departmentId: 'dept-a', isGlobal: false };
const managerGlobal: DataScope = { role: 'audit-manager', departmentId: null, isGlobal: true };

const ACTION_ROW = {
  id: 'act-1',
  capaId: 'capa-b',
  title: 'x',
  description: null,
  actionType: 'CORRECTIVE' as const,
  ownerId: null,
  owner: null,
  priority: 'MEDIUM' as const,
  status: 'OPEN' as const,
  dueDate: null,
  completedAt: null,
  completionComment: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  _count: { evidence: 0 },
  verifications: [] as {
    id: string;
    actionId: string;
    verifiedById: string;
    verifiedBy: { firstName: string; lastName: string } | null;
    result: 'PASSED' | 'FAILED';
    notes: string | null;
    verifiedAt: Date;
  }[],
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
    capaAction: {
      findMany: MockFn;
      findUnique: MockFn;
      create: MockFn;
      update: MockFn;
      delete: MockFn;
    };
    capaActionEvidence: { findFirst: MockFn; findMany: MockFn; create: MockFn };
    capaActionVerification: { create: MockFn };
  };
  let storage: { presignedDownloadUrl: MockFn; putObject: MockFn };
  let notifications: { emit: MockFn };

  beforeEach(() => {
    prisma = {
      capa: { findFirst: vi.fn() },
      capaAction: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      capaActionEvidence: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
      capaActionVerification: { create: vi.fn() },
    };
    storage = {
      presignedDownloadUrl: vi.fn().mockResolvedValue('https://minio.local/signed'),
      putObject: vi.fn(),
    };
    notifications = { emit: vi.fn().mockResolvedValue(null) };
    service = new CapaActionsService(
      prisma as unknown as PrismaService,
      storage as unknown as StorageService,
      { record: vi.fn() } as unknown as AuditLogService,
      { record: vi.fn() } as unknown as ActivityTimelineService,
      notifications as unknown as NotificationService,
    );
  });

  describe('list', () => {
    it('denies a Pilot listing actions for a CAPA outside their department', async () => {
      prisma.capa.findFirst.mockResolvedValue(null);
      await expect(service.list('capa-in-dept-b', pilotDeptA)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.capaAction.findMany).not.toHaveBeenCalled();
    });

    it('allows a Pilot to list actions for a CAPA in their own department', async () => {
      prisma.capa.findFirst.mockResolvedValue({
        id: 'capa-1',
        departmentId: 'dept-a',
        processId: null,
      });
      prisma.capaAction.findMany.mockResolvedValue([]);
      await expect(service.list('capa-1', pilotDeptA)).resolves.toEqual([]);
    });

    it('allows a global Audit Manager to list actions for any department', async () => {
      prisma.capa.findFirst.mockResolvedValue({
        id: 'capa-in-dept-b',
        departmentId: 'dept-b',
        processId: null,
      });
      prisma.capaAction.findMany.mockResolvedValue([]);
      await expect(service.list('capa-in-dept-b', managerGlobal)).resolves.toEqual([]);
    });
  });

  describe('create', () => {
    it('denies a Pilot creating an action against a CAPA outside their department', async () => {
      prisma.capa.findFirst.mockResolvedValue(null);
      await expect(
        service.create('capa-in-dept-b', { title: 'Fix it' }, ACTOR, pilotDeptA),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.capaAction.create).not.toHaveBeenCalled();
    });

    it('allows a Pilot to create an action against a CAPA in their own department', async () => {
      prisma.capa.findFirst.mockResolvedValue({
        id: 'capa-1',
        departmentId: 'dept-a',
        processId: 'p1',
      });
      prisma.capaAction.create.mockResolvedValue({
        ...ACTION_ROW,
        id: 'act-2',
        capaId: 'capa-1',
        title: 'Fix it',
      });
      const action = await service.create('capa-1', { title: 'Fix it' }, ACTOR, pilotDeptA);
      expect(action.title).toBe('Fix it');
    });
  });

  describe('update / remove / evidence', () => {
    it('denies updating an action whose CAPA belongs to another department', async () => {
      prisma.capaAction.findUnique.mockResolvedValue({
        ...ACTION_ROW,
        capa: { departmentId: 'dept-b' },
      });
      await expect(
        service.update('act-1', { title: 'x' }, ACTOR, pilotDeptA),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.capaAction.update).not.toHaveBeenCalled();
    });

    it('denies removing an action whose CAPA belongs to another department', async () => {
      prisma.capaAction.findUnique.mockResolvedValue({
        ...ACTION_ROW,
        capa: { departmentId: 'dept-b' },
      });
      await expect(service.remove('act-1', pilotDeptA)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.capaAction.delete).not.toHaveBeenCalled();
    });

    it('denies uploading evidence to an action whose CAPA belongs to another department', async () => {
      prisma.capaAction.findUnique.mockResolvedValue({
        ...ACTION_ROW,
        capa: { processId: null, departmentId: 'dept-b' },
      });
      await expect(
        service.uploadEvidence(
          'act-1',
          { originalname: 'f.pdf', buffer: Buffer.from('x'), mimetype: 'application/pdf', size: 1 },
          null,
          ACTOR,
          pilotDeptA,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(storage.putObject).not.toHaveBeenCalled();
    });

    it('denies downloading action evidence whose CAPA belongs to another department', async () => {
      prisma.capaActionEvidence.findFirst.mockResolvedValue({
        id: 'ev-1',
        fileKey: 'k',
        action: { capa: { departmentId: 'dept-b' } },
      });
      await expect(service.downloadUrl('act-1', 'ev-1', pilotDeptA)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(storage.presignedDownloadUrl).not.toHaveBeenCalled();
    });

    it('allows a global Audit Manager to update an action from any department', async () => {
      prisma.capaAction.findUnique.mockResolvedValue({
        ...ACTION_ROW,
        capa: { departmentId: 'dept-b' },
      });
      prisma.capaAction.update.mockResolvedValue({ ...ACTION_ROW, title: 'y' });
      await expect(
        service.update('act-1', { title: 'y' }, ACTOR, managerGlobal),
      ).resolves.toMatchObject({ title: 'y' });
    });

    it('allows a Pilot to access their own department CAPA action evidence', async () => {
      prisma.capaActionEvidence.findFirst.mockResolvedValue({
        id: 'ev-1',
        fileKey: 'k',
        action: { capa: { departmentId: 'dept-a' } },
      });
      await expect(service.downloadUrl('act-1', 'ev-1', pilotDeptA)).resolves.toEqual({
        url: 'https://minio.local/signed',
      });
    });
  });

  describe('listEvidence', () => {
    it('denies listing evidence for an action whose CAPA belongs to another department', async () => {
      prisma.capaAction.findUnique.mockResolvedValue({
        ...ACTION_ROW,
        capa: { departmentId: 'dept-b' },
      });
      await expect(service.listEvidence('act-1', pilotDeptA)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.capaActionEvidence.findMany).not.toHaveBeenCalled();
    });

    it('returns evidence metadata (not the raw file) for an in-scope action', async () => {
      prisma.capaAction.findUnique.mockResolvedValue({
        ...ACTION_ROW,
        capa: { departmentId: 'dept-a' },
      });
      prisma.capaActionEvidence.findMany.mockResolvedValue([
        {
          id: 'ev-1',
          actionId: 'act-1',
          fileName: 'photo.png',
          mimeType: 'image/png',
          sizeBytes: 1024,
          comment: null,
          uploadedById: 'pilot-a',
          uploadedBy: { firstName: 'P', lastName: 'A' },
          createdAt: new Date(0),
        },
      ]);
      const evidence = await service.listEvidence('act-1', pilotDeptA);
      expect(evidence).toEqual([
        {
          id: 'ev-1',
          actionId: 'act-1',
          fileName: 'photo.png',
          mimeType: 'image/png',
          sizeBytes: 1024,
          comment: null,
          uploadedById: 'pilot-a',
          uploadedByName: 'P A',
          createdAt: new Date(0).toISOString(),
        },
      ]);
    });
  });

  describe('verifyAction — individual per-action verification (Manager only, enforced server-side)', () => {
    const PENDING_CAPA = {
      id: 'capa-1',
      departmentId: 'dept-a',
      status: 'PENDING_VERIFICATION',
      processId: null,
      referenceNumber: 'CAPA-001',
      title: 'Fix the line',
      ownerId: 'pilot-a',
      createdById: 'pilot-a',
    };

    it('PASSES an action: creates an immutable verification row and moves the action to VERIFIED', async () => {
      prisma.capaAction.findUnique.mockResolvedValue({
        ...ACTION_ROW,
        status: 'COMPLETED',
        capa: PENDING_CAPA,
      });
      prisma.capaActionVerification.create.mockResolvedValue({
        id: 'v1',
        actionId: 'act-1',
        verifiedById: 'manager-1',
        result: 'PASSED',
        notes: null,
        verifiedAt: new Date(),
      });
      prisma.capaAction.update.mockResolvedValue({
        ...ACTION_ROW,
        status: 'VERIFIED',
        verifications: [
          {
            id: 'v1',
            actionId: 'act-1',
            verifiedById: 'manager-1',
            verifiedBy: null,
            result: 'PASSED',
            notes: null,
            verifiedAt: new Date(),
          },
        ],
      });

      const result = await service.verifyAction(
        'act-1',
        { result: 'PASSED' },
        MANAGER_ACTOR,
        managerGlobal,
      );
      expect(result.status).toBe('VERIFIED');
      expect(result.verificationStatus).toBe('PASSED');
      expect(prisma.capaActionVerification.create).toHaveBeenCalledTimes(1);
      expect(prisma.capaAction.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'VERIFIED' } }),
      );
    });

    it('FAILS an action: requires a reason, records it, and moves the action back to IN_PROGRESS for rework', async () => {
      prisma.capaAction.findUnique.mockResolvedValue({
        ...ACTION_ROW,
        status: 'COMPLETED',
        capa: PENDING_CAPA,
      });
      prisma.capaActionVerification.create.mockResolvedValue({
        id: 'v2',
        actionId: 'act-1',
        verifiedById: 'manager-1',
        result: 'FAILED',
        notes: 'Evidence insufficient',
        verifiedAt: new Date(),
      });
      prisma.capaAction.update.mockResolvedValue({
        ...ACTION_ROW,
        status: 'IN_PROGRESS',
        verifications: [
          {
            id: 'v2',
            actionId: 'act-1',
            verifiedById: 'manager-1',
            verifiedBy: null,
            result: 'FAILED',
            notes: 'Evidence insufficient',
            verifiedAt: new Date(),
          },
        ],
      });

      const result = await service.verifyAction(
        'act-1',
        { result: 'FAILED', notes: 'Evidence insufficient' },
        MANAGER_ACTOR,
        managerGlobal,
      );
      expect(result.status).toBe('IN_PROGRESS');
      expect(result.verificationStatus).toBe('FAILED');
      expect(prisma.capaAction.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'IN_PROGRESS' } }),
      );
    });

    it('rejects a FAILED verification with no reason', async () => {
      prisma.capaAction.findUnique.mockResolvedValue({
        ...ACTION_ROW,
        status: 'COMPLETED',
        capa: PENDING_CAPA,
      });
      await expect(
        service.verifyAction('act-1', { result: 'FAILED' }, MANAGER_ACTOR, managerGlobal),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.capaActionVerification.create).not.toHaveBeenCalled();
    });

    it('rejects verifying an action whose parent CAPA is not PENDING_VERIFICATION', async () => {
      prisma.capaAction.findUnique.mockResolvedValue({
        ...ACTION_ROW,
        capa: { ...PENDING_CAPA, status: 'IN_PROGRESS' },
      });
      await expect(
        service.verifyAction('act-1', { result: 'PASSED' }, MANAGER_ACTOR, managerGlobal),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.capaActionVerification.create).not.toHaveBeenCalled();
    });

    it('rejects a department-scoped caller verifying an action outside their department (no existence leak)', async () => {
      prisma.capaAction.findUnique.mockResolvedValue({
        ...ACTION_ROW,
        capa: { ...PENDING_CAPA, departmentId: 'dept-b' },
      });
      await expect(
        service.verifyAction('act-1', { result: 'PASSED' }, ACTOR, pilotDeptA),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.capaActionVerification.create).not.toHaveBeenCalled();
    });

    it("notifies the CAPA owner on failure, with the manager's reason, deduped per verification attempt", async () => {
      prisma.capaAction.findUnique.mockResolvedValue({
        ...ACTION_ROW,
        status: 'COMPLETED',
        capa: PENDING_CAPA,
      });
      prisma.capaActionVerification.create.mockResolvedValue({
        id: 'v3',
        actionId: 'act-1',
        verifiedById: 'manager-1',
        result: 'FAILED',
        notes: 'Missing signature',
        verifiedAt: new Date(),
      });
      prisma.capaAction.update.mockResolvedValue({
        ...ACTION_ROW,
        status: 'IN_PROGRESS',
        verifications: [],
      });

      await service.verifyAction(
        'act-1',
        { result: 'FAILED', notes: 'Missing signature' },
        MANAGER_ACTOR,
        managerGlobal,
      );

      expect(notifications.emit).toHaveBeenCalledTimes(1);
      expect(notifications.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'pilot-a',
          type: 'CAPA_ACTION_FAILED',
          entityId: 'v3',
          entityType: 'capa_action_verification',
          params: expect.objectContaining({ reference: 'CAPA-001', notes: 'Missing signature' }),
        }),
      );
    });

    it('does not self-notify when the CAPA owner is the one verifying', async () => {
      prisma.capaAction.findUnique.mockResolvedValue({
        ...ACTION_ROW,
        status: 'COMPLETED',
        capa: PENDING_CAPA,
      }); // ownerId: 'pilot-a'
      prisma.capaActionVerification.create.mockResolvedValue({
        id: 'v4',
        actionId: 'act-1',
        verifiedById: 'pilot-a',
        result: 'PASSED',
        notes: null,
        verifiedAt: new Date(),
      });
      prisma.capaAction.update.mockResolvedValue({
        ...ACTION_ROW,
        status: 'VERIFIED',
        verifications: [],
      });

      await service.verifyAction('act-1', { result: 'PASSED' }, ACTOR, managerGlobal); // ACTOR.actorId === 'pilot-a' === capa.ownerId
      expect(notifications.emit).not.toHaveBeenCalled();
    });
  });
});

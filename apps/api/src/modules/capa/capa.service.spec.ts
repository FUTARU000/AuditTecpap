import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { renderNotification } from '@tecpap/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DataScope } from '../../common/types/data-scope';
import type { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import type { AuditLogService } from '../audit-log/audit-log.service';
import type { NotificationService } from '../productivity/notification.service';
import type { PrismaService } from '../prisma/prisma.service';
import { CapaService } from './capa.service';

const ACTOR = { actorId: 'u1', ipAddress: null, userAgent: null };
const pilotDeptA: DataScope = { role: 'pilot', departmentId: 'dept-a', isGlobal: false };
const managerGlobal: DataScope = { role: 'audit-manager', departmentId: null, isGlobal: true };

/** Full DETAIL-shaped mock, as `prisma.capa.update/findFirst(..., { include: DETAIL_INCLUDE })` would return. */
function fullCapaDetail(overrides: Partial<{ status: string; verifications: unknown[] }> = {}) {
  return {
    id: 'c1',
    referenceNumber: 'CAPA-2026-0001',
    title: 'T',
    description: null,
    sourceType: 'MANUAL',
    sourceId: null,
    findingId: null,
    departmentId: 'd1',
    processId: null,
    ownerId: null,
    createdById: 'u1',
    priority: 'MEDIUM',
    status: overrides.status ?? 'PENDING_VERIFICATION',
    targetDate: null,
    openedAt: null,
    submittedAt: null,
    verifiedAt: null,
    effectivenessDueDate: null,
    effectivenessReviewedAt: null,
    closedAt: null,
    closedById: null,
    closureComment: null,
    deletedAt: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    department: { name: 'D' },
    process: null,
    owner: null,
    createdBy: { firstName: 'A', lastName: 'B' },
    closedBy: null,
    finding: null,
    rootCause: {
      id: 'r1',
      problemStatement: null,
      immediateCause: null,
      rootCause: null,
      contributingFactors: null,
      analysisNotes: null,
      useFiveWhys: false,
      useEightD: false,
      whySteps: [],
      eightD: null,
    },
    actions: [],
    effectiveness: null,
    verifications: overrides.verifications ?? [],
  };
}

describe('CapaService (workflow + transitions)', () => {
  type MockFn = ReturnType<typeof vi.fn>;
  let service: CapaService;
  let prisma: {
    capa: {
      findFirst: MockFn;
      findUnique: MockFn;
      findMany: MockFn;
      count: MockFn;
      create: MockFn;
      update: MockFn;
      aggregate: MockFn;
    };
    capaRootCauseAnalysis: { upsert: MockFn };
    capaWhyStep: { create: MockFn; delete: MockFn };
    capaEightD: { upsert: MockFn };
    capaVerification: { create: MockFn };
    capaEffectivenessReview: { upsert: MockFn };
  };
  let notifications: { emit: MockFn };

  beforeEach(() => {
    prisma = {
      capa: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn(),
        update: vi.fn(),
        aggregate: vi.fn(),
      },
      capaRootCauseAnalysis: { upsert: vi.fn() },
      capaWhyStep: { create: vi.fn(), delete: vi.fn() },
      capaEightD: { upsert: vi.fn() },
      capaVerification: { create: vi.fn().mockResolvedValue({ id: 'v-mock' }) },
      capaEffectivenessReview: { upsert: vi.fn() },
    };
    notifications = { emit: vi.fn().mockResolvedValue(null) };
    service = new CapaService(
      prisma as unknown as PrismaService,
      { record: vi.fn() } as unknown as AuditLogService,
      { record: vi.fn() } as unknown as ActivityTimelineService,
      notifications as unknown as NotificationService,
    );
  });

  it('rejects invalid status transition (DRAFT → CLOSED)', async () => {
    prisma.capa.findFirst.mockResolvedValue({
      id: 'c1',
      status: 'DRAFT',
      referenceNumber: 'CAPA-2026-0001',
      processId: null,
      openedAt: null,
      actions: [],
      verifications: [],
      effectiveness: null,
    });
    await expect(service.transition('c1', 'CLOSED', ACTOR)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('allows valid transition (DRAFT → ROOT_CAUSE_ANALYSIS)', async () => {
    prisma.capa.findFirst.mockResolvedValue({
      id: 'c1',
      status: 'DRAFT',
      referenceNumber: 'CAPA-2026-0001',
      processId: null,
      openedAt: null,
      actions: [],
      verifications: [],
      effectiveness: null,
    });
    prisma.capa.update.mockResolvedValue({
      id: 'c1',
      status: 'ROOT_CAUSE_ANALYSIS',
      referenceNumber: 'CAPA-2026-0001',
      title: 'T',
      description: null,
      sourceType: 'MANUAL',
      sourceId: null,
      findingId: null,
      departmentId: 'd1',
      processId: null,
      ownerId: null,
      createdById: 'u1',
      priority: 'MEDIUM',
      targetDate: null,
      openedAt: null,
      submittedAt: null,
      verifiedAt: null,
      effectivenessDueDate: null,
      effectivenessReviewedAt: null,
      closedAt: null,
      closedById: null,
      closureComment: null,
      deletedAt: null,
      createdAt: new Date(0),
      updatedAt: new Date(0),
      department: { name: 'D' },
      process: null,
      owner: null,
      createdBy: { firstName: 'A', lastName: 'B' },
      closedBy: null,
      finding: null,
      rootCause: {
        id: 'r1',
        problemStatement: null,
        immediateCause: null,
        rootCause: null,
        contributingFactors: null,
        analysisNotes: null,
        useFiveWhys: false,
        useEightD: false,
        whySteps: [],
        eightD: null,
      },
      actions: [],
      verifications: [],
      effectiveness: null,
    });
    await service.transition('c1', 'ROOT_CAUSE_ANALYSIS', ACTOR);
    expect(prisma.capa.update).toHaveBeenCalled();
  });

  it('prevents closure without verification', async () => {
    prisma.capa.findFirst.mockResolvedValue({
      id: 'c1',
      status: 'PENDING_EFFECTIVENESS',
      referenceNumber: 'CAPA-2026-0001',
      processId: null,
      openedAt: null,
      actions: [],
      verifications: [{ result: 'PASSED' }],
      effectiveness: { result: 'INEFFECTIVE' },
    });
    await expect(service.transition('c1', 'CLOSED', ACTOR)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('generates sequential reference numbers', async () => {
    prisma.capa.count.mockResolvedValue(3);
    prisma.capa.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({
        ...data,
        id: 'c1',
        status: 'DRAFT',
        referenceNumber: 'CAPA-2026-0004',
        department: { name: 'D' },
        process: null,
        owner: null,
        createdBy: null,
        closedBy: null,
        finding: null,
        rootCause: {
          id: 'r1',
          problemStatement: null,
          immediateCause: null,
          rootCause: null,
          contributingFactors: null,
          analysisNotes: null,
          useFiveWhys: false,
          useEightD: false,
          whySteps: [],
          eightD: null,
        },
        actions: [],
        verifications: [],
        effectiveness: null,
        createdAt: new Date(0),
        updatedAt: new Date(0),
        openedAt: null,
        submittedAt: null,
        verifiedAt: null,
        effectivenessDueDate: null,
        effectivenessReviewedAt: null,
        closedAt: null,
        closedById: null,
        closureComment: null,
        deletedAt: null,
        departmentId: 'd1',
        processId: null,
        ownerId: null,
        createdById: 'u1',
        priority: 'MEDIUM',
        targetDate: null,
        sourceType: 'MANUAL',
        sourceId: null,
        findingId: null,
      }),
    );
    const capa = await service.create({ title: 'Test', departmentId: 'd1' }, ACTOR);
    expect(capa.referenceNumber).toBe('CAPA-2026-0004');
  });

  describe('create — department isolation', () => {
    const mockCreate = () => {
      prisma.capa.count.mockResolvedValue(0);
      prisma.capa.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({
          ...data,
          id: 'c1',
          referenceNumber: 'CAPA-2026-0001',
          department: { name: 'D' },
          process: null,
          owner: null,
          createdBy: null,
          closedBy: null,
          finding: null,
          rootCause: {
            id: 'r1',
            problemStatement: null,
            immediateCause: null,
            rootCause: null,
            contributingFactors: null,
            analysisNotes: null,
            useFiveWhys: false,
            useEightD: false,
            whySteps: [],
            eightD: null,
          },
          actions: [],
          verifications: [],
          effectiveness: null,
          createdAt: new Date(0),
          updatedAt: new Date(0),
          openedAt: null,
          submittedAt: null,
          verifiedAt: null,
          effectivenessDueDate: null,
          effectivenessReviewedAt: null,
          closedAt: null,
          closedById: null,
          closureComment: null,
          deletedAt: null,
          processId: null,
          ownerId: null,
          createdById: 'u1',
          priority: 'MEDIUM',
          targetDate: null,
          sourceType: 'MANUAL',
          sourceId: null,
          findingId: null,
        }),
      );
    };

    it('denies a Pilot creating a CAPA in another department by supplying another departmentId', async () => {
      mockCreate();
      await expect(
        service.create({ title: 'Test', departmentId: 'dept-b' }, ACTOR, undefined, pilotDeptA),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.capa.create).not.toHaveBeenCalled();
    });

    it('allows a Pilot to create a CAPA in their own department', async () => {
      mockCreate();
      const capa = await service.create(
        { title: 'Test', departmentId: 'dept-a' },
        ACTOR,
        undefined,
        pilotDeptA,
      );
      expect(capa.departmentId).toBe('dept-a');
    });

    it('allows a global Audit Manager to create a CAPA in any department', async () => {
      mockCreate();
      const capa = await service.create(
        { title: 'Test', departmentId: 'dept-b' },
        ACTOR,
        undefined,
        managerGlobal,
      );
      expect(capa.departmentId).toBe('dept-b');
    });

    it('does not enforce scope when no scope is passed (trusted internal callers, e.g. auto-CAPA)', async () => {
      mockCreate();
      const capa = await service.create(
        { title: 'Test', departmentId: 'dept-b' },
        ACTOR,
        'ASSIGNED',
      );
      expect(capa.departmentId).toBe('dept-b');
      expect(capa.status).toBe('ASSIGNED');
    });
  });

  describe('duplicate-name prevention', () => {
    it('rejects creating a CAPA whose normalized title collides with an existing non-deleted CAPA', async () => {
      prisma.capa.findFirst.mockResolvedValue({ id: 'existing-capa' });
      await expect(
        service.create({ title: '  Spill Containment  ', departmentId: 'd1' }, ACTOR),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.capa.create).not.toHaveBeenCalled();
    });

    it('rejects renaming a CAPA to a title already used by another CAPA', async () => {
      prisma.capa.findFirst
        .mockResolvedValueOnce({ id: 'c1', title: 'Old Title', status: 'DRAFT' })
        .mockResolvedValueOnce({ id: 'other-capa' });
      await expect(service.update('c1', { title: 'Taken Title' }, ACTOR)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.capa.update).not.toHaveBeenCalled();
    });

    it('allows a CAPA to keep its own title on update', async () => {
      prisma.capa.findFirst
        .mockResolvedValueOnce({ id: 'c1', title: 'Same Title', status: 'DRAFT' })
        .mockResolvedValueOnce(null);
      prisma.capa.update.mockResolvedValue(fullCapaDetail({ status: 'DRAFT' }));
      const updated = await service.update('c1', { title: 'Same Title' }, ACTOR);
      expect(updated.id).toBe('c1');
    });
  });

  describe('verify — audit trail (Phase 3: one immutable row per attempt)', () => {
    it('a first PASSED verification creates exactly one verification record (create, never upsert)', async () => {
      prisma.capa.findFirst.mockResolvedValue({
        id: 'c1',
        status: 'PENDING_VERIFICATION',
        referenceNumber: 'CAPA-2026-0001',
        processId: null,
        title: 'T',
        departmentId: 'd1',
        ownerId: 'pilot-1',
        createdById: 'mgr-1',
        actions: [],
      });
      prisma.capa.update.mockResolvedValue(
        fullCapaDetail({
          status: 'VALIDATED',
          verifications: [
            {
              id: 'v1',
              verifiedById: 'mgr-1',
              verifiedBy: { firstName: 'M', lastName: 'G' },
              result: 'PASSED',
              notes: null,
              verifiedAt: new Date(0),
            },
          ],
        }),
      );
      const result = await service.verify('c1', 'PASSED', null, { ...ACTOR, actorId: 'mgr-1' });
      expect(prisma.capaVerification.create).toHaveBeenCalledTimes(1);
      expect(prisma.capaVerification.create).toHaveBeenCalledWith({
        data: { capaId: 'c1', verifiedById: 'mgr-1', result: 'PASSED', notes: null },
      });
      expect(result.verifications).toHaveLength(1);
    });

    it('a first FAILED verification creates exactly one verification record', async () => {
      prisma.capa.findFirst.mockResolvedValue({
        id: 'c1',
        status: 'PENDING_VERIFICATION',
        referenceNumber: 'CAPA-2026-0001',
        processId: null,
        title: 'T',
        departmentId: 'd1',
        ownerId: 'pilot-1',
        createdById: 'mgr-1',
        actions: [],
      });
      prisma.capa.update.mockResolvedValue(
        fullCapaDetail({
          status: 'RETURNED',
          verifications: [
            {
              id: 'v1',
              verifiedById: 'mgr-1',
              verifiedBy: { firstName: 'M', lastName: 'G' },
              result: 'FAILED',
              notes: 'Not sufficient',
              verifiedAt: new Date(0),
            },
          ],
        }),
      );
      const result = await service.verify('c1', 'FAILED', 'Not sufficient', {
        ...ACTOR,
        actorId: 'mgr-1',
      });
      expect(prisma.capaVerification.create).toHaveBeenCalledTimes(1);
      expect(result.verifications).toHaveLength(1);
    });

    it('FAILED transitions the CAPA to RETURNED', async () => {
      prisma.capa.findFirst.mockResolvedValue({
        id: 'c1',
        status: 'PENDING_VERIFICATION',
        referenceNumber: 'CAPA-2026-0001',
        processId: null,
        title: 'T',
        departmentId: 'd1',
        ownerId: 'pilot-1',
        createdById: 'mgr-1',
        actions: [],
      });
      prisma.capa.update.mockResolvedValue(fullCapaDetail({ status: 'RETURNED' }));
      const result = await service.verify('c1', 'FAILED', null, ACTOR);
      expect(prisma.capa.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'RETURNED' }) }),
      );
      expect(result.status).toBe('RETURNED');
    });

    it('PASSED transitions the CAPA to VALIDATED', async () => {
      prisma.capa.findFirst.mockResolvedValue({
        id: 'c1',
        status: 'PENDING_VERIFICATION',
        referenceNumber: 'CAPA-2026-0001',
        processId: null,
        title: 'T',
        departmentId: 'd1',
        ownerId: 'pilot-1',
        createdById: 'mgr-1',
        actions: [],
      });
      prisma.capa.update.mockResolvedValue(fullCapaDetail({ status: 'VALIDATED' }));
      const result = await service.verify('c1', 'PASSED', null, ACTOR);
      expect(prisma.capa.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'VALIDATED' }) }),
      );
      expect(result.status).toBe('VALIDATED');
    });

    it('FAILED → rework → resubmit → FAILED creates TWO verification records, not one overwritten row', async () => {
      prisma.capa.findFirst.mockResolvedValue({
        id: 'c1',
        status: 'PENDING_VERIFICATION',
        referenceNumber: 'CAPA-2026-0001',
        processId: null,
        title: 'T',
        departmentId: 'd1',
        ownerId: 'pilot-1',
        createdById: 'mgr-1',
        actions: [],
      });
      prisma.capa.update.mockResolvedValue(fullCapaDetail({ status: 'RETURNED' }));
      await service.verify('c1', 'FAILED', 'First attempt insufficient', ACTOR);
      await service.verify('c1', 'FAILED', 'Second attempt insufficient', ACTOR);
      expect(prisma.capaVerification.create).toHaveBeenCalledTimes(2);
      expect(prisma.capaVerification.create).toHaveBeenNthCalledWith(1, {
        data: {
          capaId: 'c1',
          verifiedById: 'u1',
          result: 'FAILED',
          notes: 'First attempt insufficient',
        },
      });
      expect(prisma.capaVerification.create).toHaveBeenNthCalledWith(2, {
        data: {
          capaId: 'c1',
          verifiedById: 'u1',
          result: 'FAILED',
          notes: 'Second attempt insufficient',
        },
      });
    });

    it('FAILED → rework → resubmit → PASSED creates TWO verification records', async () => {
      prisma.capa.findFirst.mockResolvedValue({
        id: 'c1',
        status: 'PENDING_VERIFICATION',
        referenceNumber: 'CAPA-2026-0001',
        processId: null,
        title: 'T',
        departmentId: 'd1',
        ownerId: 'pilot-1',
        createdById: 'mgr-1',
        actions: [],
      });
      prisma.capa.update
        .mockResolvedValueOnce(fullCapaDetail({ status: 'RETURNED' }))
        .mockResolvedValueOnce(fullCapaDetail({ status: 'VALIDATED' }));
      await service.verify('c1', 'FAILED', null, ACTOR);
      await service.verify('c1', 'PASSED', null, ACTOR);
      expect(prisma.capaVerification.create).toHaveBeenCalledTimes(2);
      expect(prisma.capaVerification.create).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ data: expect.objectContaining({ result: 'FAILED' }) }),
      );
      expect(prisma.capaVerification.create).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ data: expect.objectContaining({ result: 'PASSED' }) }),
      );
    });

    it('multiple failed attempts preserve every record (unlimited verification loop)', async () => {
      prisma.capa.findFirst.mockResolvedValue({
        id: 'c1',
        status: 'PENDING_VERIFICATION',
        referenceNumber: 'CAPA-2026-0001',
        processId: null,
        title: 'T',
        departmentId: 'd1',
        ownerId: 'pilot-1',
        createdById: 'mgr-1',
        actions: [],
      });
      prisma.capa.update.mockResolvedValue(fullCapaDetail({ status: 'RETURNED' }));
      await service.verify('c1', 'FAILED', null, ACTOR);
      await service.verify('c1', 'FAILED', null, ACTOR);
      await service.verify('c1', 'FAILED', null, ACTOR);
      prisma.capa.update.mockResolvedValueOnce(fullCapaDetail({ status: 'VALIDATED' }));
      await service.verify('c1', 'PASSED', null, ACTOR);
      expect(prisma.capaVerification.create).toHaveBeenCalledTimes(4);
    });

    it('each verification record carries the correct verifier (verifiedById)', async () => {
      prisma.capa.findFirst.mockResolvedValue({
        id: 'c1',
        status: 'PENDING_VERIFICATION',
        referenceNumber: 'CAPA-2026-0001',
        processId: null,
        title: 'T',
        departmentId: 'd1',
        ownerId: 'pilot-1',
        createdById: 'mgr-1',
        actions: [],
      });
      prisma.capa.update.mockResolvedValue(fullCapaDetail());
      await service.verify('c1', 'PASSED', null, {
        actorId: 'auditor-42',
        ipAddress: null,
        userAgent: null,
      });
      expect(prisma.capaVerification.create).toHaveBeenCalledWith({
        data: { capaId: 'c1', verifiedById: 'auditor-42', result: 'PASSED', notes: null },
      });
    });

    it('never sets verifiedAt explicitly — each row gets its own DB-generated timestamp, never copied from a prior attempt', async () => {
      prisma.capa.findFirst.mockResolvedValue({
        id: 'c1',
        status: 'PENDING_VERIFICATION',
        referenceNumber: 'CAPA-2026-0001',
        processId: null,
        title: 'T',
        departmentId: 'd1',
        ownerId: 'pilot-1',
        createdById: 'mgr-1',
        actions: [],
      });
      prisma.capa.update.mockResolvedValue(fullCapaDetail());
      await service.verify('c1', 'FAILED', null, ACTOR);
      const [{ data }] = prisma.capaVerification.create.mock.calls[0] as [
        { data: Record<string, unknown> },
      ];
      expect(data).not.toHaveProperty('verifiedAt');
    });

    it('never updates or upserts a previous verification record — only ever creates new ones', async () => {
      prisma.capa.findFirst.mockResolvedValue({
        id: 'c1',
        status: 'PENDING_VERIFICATION',
        referenceNumber: 'CAPA-2026-0001',
        processId: null,
        title: 'T',
        departmentId: 'd1',
        ownerId: 'pilot-1',
        createdById: 'mgr-1',
        actions: [],
      });
      prisma.capa.update.mockResolvedValue(fullCapaDetail({ status: 'RETURNED' }));
      await service.verify('c1', 'FAILED', null, ACTOR);
      await service.verify('c1', 'FAILED', null, ACTOR);
      expect('update' in prisma.capaVerification).toBe(false);
      expect('upsert' in prisma.capaVerification).toBe(false);
    });

    it('rejects verification from a CAPA that is not PENDING_VERIFICATION', async () => {
      prisma.capa.findFirst.mockResolvedValue({
        id: 'c1',
        status: 'IN_PROGRESS',
        referenceNumber: 'CAPA-2026-0001',
        processId: null,
      });
      await expect(service.verify('c1', 'PASSED', null, ACTOR)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.capaVerification.create).not.toHaveBeenCalled();
    });

    describe('logical consistency with individual action verification', () => {
      it("rejects a PASSED general verification when an action's latest individual verification is FAILED", async () => {
        prisma.capa.findFirst.mockResolvedValue({
          id: 'c1',
          status: 'PENDING_VERIFICATION',
          referenceNumber: 'CAPA-2026-0001',
          processId: null,
          title: 'T',
          departmentId: 'd1',
          ownerId: 'pilot-1',
          createdById: 'mgr-1',
          actions: [
            { title: 'Action 1', verifications: [{ result: 'PASSED', verifiedAt: new Date(0) }] },
            { title: 'Action 2', verifications: [{ result: 'FAILED', verifiedAt: new Date(0) }] },
          ],
        });
        await expect(service.verify('c1', 'PASSED', null, ACTOR)).rejects.toThrow(/Action 2/);
        expect(prisma.capaVerification.create).not.toHaveBeenCalled();
      });

      it('allows a PASSED general verification when every action either passed or was never individually verified', async () => {
        prisma.capa.findFirst.mockResolvedValue({
          id: 'c1',
          status: 'PENDING_VERIFICATION',
          referenceNumber: 'CAPA-2026-0001',
          processId: null,
          title: 'T',
          departmentId: 'd1',
          ownerId: 'pilot-1',
          createdById: 'mgr-1',
          actions: [
            { title: 'Action 1', verifications: [{ result: 'PASSED', verifiedAt: new Date(0) }] },
            { title: 'Action 2', verifications: [] }, // never individually reviewed — does not block (backward compatible)
          ],
        });
        prisma.capa.update.mockResolvedValue(fullCapaDetail({ status: 'VALIDATED' }));
        const result = await service.verify('c1', 'PASSED', null, ACTOR);
        expect(result.status).toBe('VALIDATED');
      });

      it('allows a PASSED general verification once the previously-failed action has since passed (rework cycle)', async () => {
        prisma.capa.findFirst.mockResolvedValue({
          id: 'c1',
          status: 'PENDING_VERIFICATION',
          referenceNumber: 'CAPA-2026-0001',
          processId: null,
          title: 'T',
          departmentId: 'd1',
          ownerId: 'pilot-1',
          createdById: 'mgr-1',
          actions: [
            {
              title: 'Action 2',
              verifications: [
                { result: 'FAILED', verifiedAt: new Date(0) },
                { result: 'PASSED', verifiedAt: new Date(1) },
              ],
            }, // latest governs
          ],
        });
        prisma.capa.update.mockResolvedValue(fullCapaDetail({ status: 'VALIDATED' }));
        const result = await service.verify('c1', 'PASSED', null, ACTOR);
        expect(result.status).toBe('VALIDATED');
      });

      it('does not block a FAILED general verification even when actions have failed (that is the expected path to RETURNED)', async () => {
        prisma.capa.findFirst.mockResolvedValue({
          id: 'c1',
          status: 'PENDING_VERIFICATION',
          referenceNumber: 'CAPA-2026-0001',
          processId: null,
          title: 'T',
          departmentId: 'd1',
          ownerId: 'pilot-1',
          createdById: 'mgr-1',
          actions: [
            { title: 'Action 2', verifications: [{ result: 'FAILED', verifiedAt: new Date(0) }] },
          ],
        });
        prisma.capa.update.mockResolvedValue(fullCapaDetail({ status: 'RETURNED' }));
        const result = await service.verify('c1', 'FAILED', null, ACTOR);
        expect(result.status).toBe('RETURNED');
      });
    });

    it('records a timeline event for the verification (existing timeline behavior preserved)', async () => {
      const timeline = { record: vi.fn() };
      const localService = new CapaService(
        prisma as unknown as PrismaService,
        { record: vi.fn() } as unknown as AuditLogService,
        timeline as unknown as ActivityTimelineService,
        notifications as unknown as NotificationService,
      );
      prisma.capa.findFirst.mockResolvedValue({
        id: 'c1',
        status: 'PENDING_VERIFICATION',
        referenceNumber: 'CAPA-2026-0001',
        processId: 'p1',
        title: 'T',
        departmentId: 'd1',
        ownerId: 'pilot-1',
        createdById: 'mgr-1',
        actions: [],
      });
      prisma.capa.update.mockResolvedValue(fullCapaDetail({ status: 'RETURNED' }));
      await localService.verify('c1', 'FAILED', null, ACTOR);
      expect(timeline.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'capa.verification_failed',
          entityType: 'capa',
          entityId: 'c1',
        }),
      );
    });

    it('close() requires the LATEST verification to be PASSED, not merely any historical PASSED', async () => {
      // Oldest attempt PASSED, but a later attempt FAILED (defensive ordering check) — latest must govern.
      prisma.capa.findFirst.mockResolvedValue({
        id: 'c1',
        status: 'VALIDATED',
        referenceNumber: 'CAPA-2026-0001',
        processId: null,
        actions: [],
        verifications: [{ result: 'PASSED' }, { result: 'FAILED' }],
        effectiveness: { result: 'EFFECTIVE' },
      });
      await expect(service.close('c1', null, ACTOR)).rejects.toBeInstanceOf(ConflictException);
    });

    it('close() succeeds when the latest (most recent) verification is PASSED, even after earlier FAILED attempts', async () => {
      prisma.capa.findFirst.mockResolvedValue({
        id: 'c1',
        status: 'VALIDATED',
        referenceNumber: 'CAPA-2026-0001',
        processId: null,
        actions: [],
        verifications: [{ result: 'FAILED' }, { result: 'FAILED' }, { result: 'PASSED' }],
        effectiveness: { result: 'EFFECTIVE' },
      });
      prisma.capa.update.mockResolvedValue(fullCapaDetail({ status: 'CLOSED' }));
      const result = await service.close('c1', null, ACTOR);
      expect(result.status).toBe('CLOSED');
    });
  });

  describe('verify — Pilot notifications (Phase 4)', () => {
    const MANAGER = { actorId: 'mgr-1', ipAddress: null, userAgent: null };

    it('a PASSED verification creates exactly one notification', async () => {
      prisma.capa.findFirst.mockResolvedValue({
        id: 'c1',
        status: 'PENDING_VERIFICATION',
        referenceNumber: 'CAPA-2026-0001',
        processId: null,
        title: 'T',
        departmentId: 'd1',
        ownerId: 'pilot-1',
        createdById: 'mgr-1',
        actions: [],
      });
      prisma.capa.update.mockResolvedValue(fullCapaDetail({ status: 'VALIDATED' }));
      await service.verify('c1', 'PASSED', null, MANAGER);
      expect(notifications.emit).toHaveBeenCalledTimes(1);
    });

    it('a FAILED verification creates exactly one notification', async () => {
      prisma.capa.findFirst.mockResolvedValue({
        id: 'c1',
        status: 'PENDING_VERIFICATION',
        referenceNumber: 'CAPA-2026-0001',
        processId: null,
        title: 'T',
        departmentId: 'd1',
        ownerId: 'pilot-1',
        createdById: 'mgr-1',
        actions: [],
      });
      prisma.capa.update.mockResolvedValue(fullCapaDetail({ status: 'RETURNED' }));
      await service.verify('c1', 'FAILED', null, MANAGER);
      expect(notifications.emit).toHaveBeenCalledTimes(1);
    });

    it('notifies the CAPA owner (the responsible Pilot), not the verifying Audit Manager', async () => {
      prisma.capa.findFirst.mockResolvedValue({
        id: 'c1',
        status: 'PENDING_VERIFICATION',
        referenceNumber: 'CAPA-2026-0001',
        processId: null,
        title: 'T',
        departmentId: 'd1',
        ownerId: 'pilot-99',
        createdById: 'mgr-1',
      });
      prisma.capa.update.mockResolvedValue(fullCapaDetail({ status: 'RETURNED' }));
      await service.verify('c1', 'FAILED', null, MANAGER);
      expect(notifications.emit).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'pilot-99' }),
      );
    });

    it('falls back to the CAPA creator when no owner is assigned (existing reminder.service.ts fallback, not a new model)', async () => {
      prisma.capa.findFirst.mockResolvedValue({
        id: 'c1',
        status: 'PENDING_VERIFICATION',
        referenceNumber: 'CAPA-2026-0001',
        processId: null,
        title: 'T',
        departmentId: 'd1',
        ownerId: null,
        createdById: 'creator-7',
      });
      prisma.capa.update.mockResolvedValue(fullCapaDetail({ status: 'RETURNED' }));
      await service.verify('c1', 'FAILED', null, MANAGER);
      expect(notifications.emit).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'creator-7' }),
      );
    });

    it('includes the CAPA reference number (via params) and links to the CAPA', async () => {
      prisma.capa.findFirst.mockResolvedValue({
        id: 'c1',
        status: 'PENDING_VERIFICATION',
        referenceNumber: 'CAPA-2026-0042',
        processId: null,
        title: 'Spill containment',
        departmentId: 'd1',
        ownerId: 'pilot-1',
        createdById: 'mgr-1',
      });
      prisma.capa.update.mockResolvedValue(fullCapaDetail({ status: 'RETURNED' }));
      await service.verify('c1', 'FAILED', null, MANAGER);
      const call = notifications.emit.mock.calls[0]![0] as {
        params: Record<string, unknown>;
        actionUrl: string;
      };
      expect(call.params.reference).toBe('CAPA-2026-0042');
      expect(call.actionUrl).toBe('/capas/c1');
    });

    it('FAILED notification (Phase 5: rendered via the shared EN template) communicates the result and that rework is required', async () => {
      prisma.capa.findFirst.mockResolvedValue({
        id: 'c1',
        status: 'PENDING_VERIFICATION',
        referenceNumber: 'CAPA-2026-0001',
        processId: null,
        title: 'T',
        departmentId: 'd1',
        ownerId: 'pilot-1',
        createdById: 'mgr-1',
        actions: [],
      });
      prisma.capa.update.mockResolvedValue(fullCapaDetail({ status: 'RETURNED' }));
      await service.verify('c1', 'FAILED', 'Missing evidence', MANAGER);
      const call = notifications.emit.mock.calls[0]![0] as {
        type: string;
        severity: string;
        params: Record<string, unknown>;
      };
      expect(call.type).toBe('CAPA_RETURNED');
      expect(call.severity).toBe('WARNING');
      const rendered = renderNotification(call.type, 'en', call.params as never)!;
      expect(rendered.message).toMatch(/rework/i);
      expect(rendered.message).toContain('Missing evidence');
    });

    it('PASSED notification (Phase 5: rendered via the shared EN template) communicates the result', async () => {
      prisma.capa.findFirst.mockResolvedValue({
        id: 'c1',
        status: 'PENDING_VERIFICATION',
        referenceNumber: 'CAPA-2026-0001',
        processId: null,
        title: 'T',
        departmentId: 'd1',
        ownerId: 'pilot-1',
        createdById: 'mgr-1',
        actions: [],
      });
      prisma.capa.update.mockResolvedValue(fullCapaDetail({ status: 'VALIDATED' }));
      await service.verify('c1', 'PASSED', null, MANAGER);
      const call = notifications.emit.mock.calls[0]![0] as {
        type: string;
        severity: string;
        params: Record<string, unknown>;
      };
      expect(call.type).toBe('CAPA_VALIDATED');
      expect(call.severity).toBe('SUCCESS');
      const rendered = renderNotification(call.type, 'en', call.params as never)!;
      expect(rendered.message).toMatch(/validated/i);
    });

    it('renders the FAILED notification correctly in French too (same params, active French dictionary)', async () => {
      prisma.capa.findFirst.mockResolvedValue({
        id: 'c1',
        status: 'PENDING_VERIFICATION',
        referenceNumber: 'CAPA-2026-0001',
        processId: null,
        title: 'T',
        departmentId: 'd1',
        ownerId: 'pilot-1',
        createdById: 'mgr-1',
        actions: [],
      });
      prisma.capa.update.mockResolvedValue(fullCapaDetail({ status: 'RETURNED' }));
      await service.verify('c1', 'FAILED', 'Preuve manquante', MANAGER);
      const call = notifications.emit.mock.calls[0]![0] as {
        type: string;
        params: Record<string, unknown>;
      };
      const rendered = renderNotification(call.type, 'fr', call.params as never)!;
      expect(rendered.title).toContain('CAPA-2026-0001');
      expect(rendered.message).toMatch(/reprise/i);
      expect(rendered.message).toContain('Preuve manquante');
    });

    it('does NOT auto-close the CAPA on PASSED — status is VALIDATED, closure remains a separate operation', async () => {
      prisma.capa.findFirst.mockResolvedValue({
        id: 'c1',
        status: 'PENDING_VERIFICATION',
        referenceNumber: 'CAPA-2026-0001',
        processId: null,
        title: 'T',
        departmentId: 'd1',
        ownerId: 'pilot-1',
        createdById: 'mgr-1',
        actions: [],
      });
      prisma.capa.update.mockResolvedValue(fullCapaDetail({ status: 'VALIDATED' }));
      const result = await service.verify('c1', 'PASSED', null, MANAGER);
      expect(result.status).toBe('VALIDATED');
      expect(prisma.capa.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'CLOSED' }) }),
      );
    });

    it('repeated FAILED verification attempts create separate, non-deduplicated notifications', async () => {
      prisma.capa.findFirst.mockResolvedValue({
        id: 'c1',
        status: 'PENDING_VERIFICATION',
        referenceNumber: 'CAPA-2026-0001',
        processId: null,
        title: 'T',
        departmentId: 'd1',
        ownerId: 'pilot-1',
        createdById: 'mgr-1',
        actions: [],
      });
      prisma.capa.update.mockResolvedValue(fullCapaDetail({ status: 'RETURNED' }));
      prisma.capaVerification.create
        .mockResolvedValueOnce({ id: 'v-attempt-1' })
        .mockResolvedValueOnce({ id: 'v-attempt-2' });
      await service.verify('c1', 'FAILED', 'first', MANAGER);
      await service.verify('c1', 'FAILED', 'second', MANAGER);
      expect(notifications.emit).toHaveBeenCalledTimes(2);
      // Distinct entityId per attempt is what prevents NotificationService.emit's
      // 24h (type, entityId, userId) dedup window from swallowing attempt #2.
      const entityIds = notifications.emit.mock.calls.map(
        (c) => (c[0] as Record<string, unknown>).entityId,
      );
      expect(entityIds).toEqual(['v-attempt-1', 'v-attempt-2']);
    });

    it('FAILED followed by PASSED creates two distinct notifications (CAPA_RETURNED then CAPA_VALIDATED)', async () => {
      prisma.capa.findFirst.mockResolvedValue({
        id: 'c1',
        status: 'PENDING_VERIFICATION',
        referenceNumber: 'CAPA-2026-0001',
        processId: null,
        title: 'T',
        departmentId: 'd1',
        ownerId: 'pilot-1',
        createdById: 'mgr-1',
        actions: [],
      });
      prisma.capa.update
        .mockResolvedValueOnce(fullCapaDetail({ status: 'RETURNED' }))
        .mockResolvedValueOnce(fullCapaDetail({ status: 'VALIDATED' }));
      await service.verify('c1', 'FAILED', null, MANAGER);
      await service.verify('c1', 'PASSED', null, MANAGER);
      expect(notifications.emit).toHaveBeenCalledTimes(2);
      expect((notifications.emit.mock.calls[0]![0] as Record<string, unknown>).type).toBe(
        'CAPA_RETURNED',
      );
      expect((notifications.emit.mock.calls[1]![0] as Record<string, unknown>).type).toBe(
        'CAPA_VALIDATED',
      );
    });

    it('a single verification call never creates more than one notification', async () => {
      prisma.capa.findFirst.mockResolvedValue({
        id: 'c1',
        status: 'PENDING_VERIFICATION',
        referenceNumber: 'CAPA-2026-0001',
        processId: null,
        title: 'T',
        departmentId: 'd1',
        ownerId: 'pilot-1',
        createdById: 'mgr-1',
        actions: [],
      });
      prisma.capa.update.mockResolvedValue(fullCapaDetail({ status: 'RETURNED' }));
      await service.verify('c1', 'FAILED', null, MANAGER);
      expect(notifications.emit).toHaveBeenCalledTimes(1);
    });

    it('does not notify when the Audit Manager verifying the CAPA is also its owner (no self-notify)', async () => {
      prisma.capa.findFirst.mockResolvedValue({
        id: 'c1',
        status: 'PENDING_VERIFICATION',
        referenceNumber: 'CAPA-2026-0001',
        processId: null,
        title: 'T',
        departmentId: 'd1',
        ownerId: 'mgr-1',
        createdById: 'mgr-1',
      });
      prisma.capa.update.mockResolvedValue(fullCapaDetail({ status: 'RETURNED' }));
      await service.verify('c1', 'FAILED', null, MANAGER);
      expect(notifications.emit).not.toHaveBeenCalled();
    });

    it("tags the notification with the CAPA's own department (never a different one)", async () => {
      prisma.capa.findFirst.mockResolvedValue({
        id: 'c1',
        status: 'PENDING_VERIFICATION',
        referenceNumber: 'CAPA-2026-0001',
        processId: null,
        title: 'T',
        departmentId: 'dept-owner',
        ownerId: 'pilot-1',
        createdById: 'mgr-1',
      });
      prisma.capa.update.mockResolvedValue(fullCapaDetail({ status: 'RETURNED' }));
      await service.verify('c1', 'FAILED', null, MANAGER);
      expect(notifications.emit).toHaveBeenCalledWith(
        expect.objectContaining({ departmentId: 'dept-owner' }),
      );
    });

    it('a notification failure (best-effort) does not fail the verification call', async () => {
      notifications.emit.mockRejectedValueOnce(new Error('email provider down'));
      prisma.capa.findFirst.mockResolvedValue({
        id: 'c1',
        status: 'PENDING_VERIFICATION',
        referenceNumber: 'CAPA-2026-0001',
        processId: null,
        title: 'T',
        departmentId: 'd1',
        ownerId: 'pilot-1',
        createdById: 'mgr-1',
        actions: [],
      });
      prisma.capa.update.mockResolvedValue(fullCapaDetail({ status: 'RETURNED' }));
      const result = await service.verify('c1', 'FAILED', null, MANAGER);
      expect(result.status).toBe('RETURNED');
    });

    it('records both the timeline event and the notification from one verify() call — neither replaces the other', async () => {
      const timeline = { record: vi.fn() };
      const localService = new CapaService(
        prisma as unknown as PrismaService,
        { record: vi.fn() } as unknown as AuditLogService,
        timeline as unknown as ActivityTimelineService,
        notifications as unknown as NotificationService,
      );
      prisma.capa.findFirst.mockResolvedValue({
        id: 'c1',
        status: 'PENDING_VERIFICATION',
        referenceNumber: 'CAPA-2026-0001',
        processId: 'p1',
        title: 'T',
        departmentId: 'd1',
        ownerId: 'pilot-1',
        createdById: 'mgr-1',
        actions: [],
      });
      prisma.capa.update.mockResolvedValue(fullCapaDetail({ status: 'RETURNED' }));
      await localService.verify('c1', 'FAILED', null, MANAGER);
      expect(timeline.record).toHaveBeenCalledTimes(1);
      expect(notifications.emit).toHaveBeenCalledTimes(1);
    });
  });

  describe('findOne — department isolation for verification history read path', () => {
    it('returns the full verification history to a global Audit Manager', async () => {
      const managerScope: DataScope = { role: 'audit-manager', departmentId: null, isGlobal: true };
      prisma.capa.findFirst.mockResolvedValue(
        fullCapaDetail({
          verifications: [
            {
              id: 'v1',
              verifiedById: 'mgr',
              verifiedBy: { firstName: 'M', lastName: 'G' },
              result: 'FAILED',
              notes: null,
              verifiedAt: new Date(0),
            },
          ],
        }),
      );
      const result = await service.findOne('c1', managerScope);
      expect(result.verifications).toHaveLength(1);
    });

    it('404s (does not leak verification history) when a Pilot requests a CAPA outside their department', async () => {
      const pilotScope: DataScope = { role: 'pilot', departmentId: 'dept-a', isGlobal: false };
      prisma.capa.findFirst.mockResolvedValue(null); // Prisma's departmentScopeWhere filtered it out
      await expect(service.findOne('c1', pilotScope)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});

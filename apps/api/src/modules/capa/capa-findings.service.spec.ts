import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DataScope } from '../../common/types/data-scope';
import type { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import type { AuditLogService } from '../audit-log/audit-log.service';
import type { NotificationService } from '../productivity/notification.service';
import type { PrismaService } from '../prisma/prisma.service';
import { CapaFindingsService } from './capa-findings.service';
import type { CapaService } from './capa.service';

const ACTOR = { actorId: 'pilot-a', ipAddress: null, userAgent: null };
const pilotDeptA: DataScope = { role: 'pilot', departmentId: 'dept-a', isGlobal: false };
const managerGlobal: DataScope = { role: 'audit-manager', departmentId: null, isGlobal: true };

const FINDING_DEPT_A = { id: 'f1', title: 'Oil leak', description: null, capaDecision: null as string | null, processId: null, responsibleUserId: null, audit: { id: 'a1', departmentId: 'dept-a', processId: 'p1' } };
const FINDING_DEPT_B = { id: 'f2', title: 'Leak B', description: null, capaDecision: null as string | null, processId: null, responsibleUserId: null, audit: { id: 'a2', departmentId: 'dept-b', processId: 'p2' } };

/**
 * Regression coverage for the department-scope fix on CapaFindingsService
 * (decide / createFromFinding), which previously accepted an arbitrary
 * findingId with no department check at all.
 */
describe('CapaFindingsService — department isolation', () => {
  type MockFn = ReturnType<typeof vi.fn>;
  let service: CapaFindingsService;
  let prisma: { finding: { findUnique: MockFn; update: MockFn }; capa: { findFirst: MockFn } };
  let capaService: { create: MockFn };

  beforeEach(() => {
    prisma = { finding: { findUnique: vi.fn(), update: vi.fn() }, capa: { findFirst: vi.fn() } };
    capaService = { create: vi.fn() };
    service = new CapaFindingsService(
      prisma as unknown as PrismaService,
      capaService as unknown as CapaService,
      { record: vi.fn() } as unknown as AuditLogService,
      { record: vi.fn() } as unknown as ActivityTimelineService,
      { emit: vi.fn() } as unknown as NotificationService,
    );
  });

  describe('decide', () => {
    it('allows a Pilot to decide a finding from their own department', async () => {
      prisma.finding.findUnique.mockResolvedValue(FINDING_DEPT_A);
      prisma.finding.update.mockResolvedValue({ capaDecision: 'REQUIRED' });
      const result = await service.decide('f1', { decision: 'REQUIRED' }, ACTOR, pilotDeptA);
      expect(result.capaDecision).toBe('REQUIRED');
    });

    it('denies a Pilot deciding a finding from another department (fails closed, 404)', async () => {
      prisma.finding.findUnique.mockResolvedValue(FINDING_DEPT_B);
      await expect(service.decide('f2', { decision: 'REQUIRED' }, ACTOR, pilotDeptA)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.finding.update).not.toHaveBeenCalled();
    });

    it('fails closed when the finding does not exist', async () => {
      prisma.finding.findUnique.mockResolvedValue(null);
      await expect(service.decide('missing', { decision: 'REQUIRED' }, ACTOR, pilotDeptA)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('allows a global Audit Manager to decide a finding in any department', async () => {
      prisma.finding.findUnique.mockResolvedValue(FINDING_DEPT_B);
      prisma.finding.update.mockResolvedValue({ capaDecision: 'NOT_REQUIRED' });
      const result = await service.decide('f2', { decision: 'NOT_REQUIRED' }, ACTOR, managerGlobal);
      expect(result.capaDecision).toBe('NOT_REQUIRED');
    });
  });

  describe('createFromFinding', () => {
    it('allows a Pilot to create a CAPA from a finding in their own department', async () => {
      prisma.finding.findUnique.mockResolvedValue({ ...FINDING_DEPT_A, capaDecision: 'REQUIRED' });
      prisma.capa.findFirst.mockResolvedValue(null);
      capaService.create.mockResolvedValue({ id: 'capa-1', departmentId: 'dept-a', referenceNumber: 'CAPA-2026-0001' });
      const capa = await service.createFromFinding('f1', {}, ACTOR, pilotDeptA);
      expect(capa.departmentId).toBe('dept-a');
      expect(capaService.create).toHaveBeenCalledWith(expect.objectContaining({ departmentId: 'dept-a' }), ACTOR, undefined, pilotDeptA);
    });

    it('denies a Pilot creating a CAPA from a finding in another department (fails closed, 404)', async () => {
      prisma.finding.findUnique.mockResolvedValue({ ...FINDING_DEPT_B, capaDecision: 'REQUIRED' });
      await expect(service.createFromFinding('f2', {}, ACTOR, pilotDeptA)).rejects.toBeInstanceOf(NotFoundException);
      expect(capaService.create).not.toHaveBeenCalled();
    });

    it('fails closed when the finding does not exist', async () => {
      prisma.finding.findUnique.mockResolvedValue(null);
      await expect(service.createFromFinding('missing', {}, ACTOR, pilotDeptA)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('invariant: a CAPA created from a finding can never be redirected into a different department via dto.departmentId', async () => {
      prisma.finding.findUnique.mockResolvedValue({ ...FINDING_DEPT_B, capaDecision: 'REQUIRED' });
      prisma.capa.findFirst.mockResolvedValue(null);
      capaService.create.mockResolvedValue({ id: 'capa-1', departmentId: 'dept-b', referenceNumber: 'CAPA-2026-0001' });
      // Even a global Audit Manager attempting to redirect a Department B finding's CAPA into Department A must be ignored.
      await service.createFromFinding('f2', { departmentId: 'dept-a' }, ACTOR, managerGlobal);
      expect(capaService.create).toHaveBeenCalledWith(expect.objectContaining({ departmentId: 'dept-b' }), ACTOR, undefined, managerGlobal);
    });

    it('allows a global Audit Manager to create a CAPA from a finding in any department', async () => {
      prisma.finding.findUnique.mockResolvedValue({ ...FINDING_DEPT_B, capaDecision: 'REQUIRED' });
      prisma.capa.findFirst.mockResolvedValue(null);
      capaService.create.mockResolvedValue({ id: 'capa-1', departmentId: 'dept-b', referenceNumber: 'CAPA-2026-0001' });
      const capa = await service.createFromFinding('f2', {}, ACTOR, managerGlobal);
      expect(capa.departmentId).toBe('dept-b');
    });
  });
});

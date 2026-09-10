import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DataScope } from '../../common/types/data-scope';
import type { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import type { AuditLogService } from '../audit-log/audit-log.service';
import type { PrismaService } from '../prisma/prisma.service';
import { FindingsService } from './findings.service';

const ACTOR = { actorId: 'u1', ipAddress: null, userAgent: null };
const pilotDeptA: DataScope = { role: 'pilot', departmentId: 'dept-a', isGlobal: false };

describe('FindingsService', () => {
  type MockFn = ReturnType<typeof vi.fn>;
  let service: FindingsService;
  let prisma: { audit: { findUnique: MockFn; findFirst: MockFn }; finding: { findMany: MockFn; create: MockFn; findUnique: MockFn; update: MockFn; delete: MockFn } };

  beforeEach(() => {
    prisma = { audit: { findUnique: vi.fn().mockResolvedValue({ id: 'a1', processId: 'p1' }), findFirst: vi.fn().mockResolvedValue({ id: 'a1', processId: 'p1' }) }, finding: { findMany: vi.fn(), create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() } };
    service = new FindingsService(prisma as unknown as PrismaService, { record: vi.fn() } as unknown as AuditLogService, { record: vi.fn() } as unknown as ActivityTimelineService);
  });

  it('creates a finding linked to the audit process', async () => {
    prisma.finding.create.mockResolvedValue({
      id: 'f1', auditId: 'a1', questionId: null, title: 'Oil leak', description: null, severity: 'MAJOR_NC',
      responsibleUserId: null, dueDate: null, status: 'OPEN', processId: 'p1', comments: null,
      createdAt: new Date(0), updatedAt: new Date(0), responsible: null,
    });
    const finding = await service.create({ auditId: 'a1', title: 'Oil leak', severity: 'MAJOR_NC' }, ACTOR, undefined);
    expect(finding.severity).toBe('MAJOR_NC');
    expect(finding.processId).toBe('p1');
    expect(prisma.finding.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ severity: 'MAJOR_NC', processId: 'p1' }) }));
  });

  describe('department isolation', () => {
    it('denies a Pilot listing findings for an audit outside their department', async () => {
      prisma.audit.findFirst.mockResolvedValue(null); // Prisma's departmentId filter excluded it
      await expect(service.listByAudit('audit-in-dept-b', pilotDeptA)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.audit.findFirst).toHaveBeenCalledWith({ where: { id: 'audit-in-dept-b', departmentId: 'dept-a' } });
      expect(prisma.finding.findMany).not.toHaveBeenCalled();
    });

    it('allows a Pilot to list findings for an audit in their own department', async () => {
      prisma.audit.findFirst.mockResolvedValue({ id: 'a1', departmentId: 'dept-a', processId: 'p1' });
      prisma.finding.findMany.mockResolvedValue([]);
      await expect(service.listByAudit('a1', pilotDeptA)).resolves.toEqual([]);
    });

    it('denies creating a finding on an audit outside the Pilot department', async () => {
      prisma.audit.findFirst.mockResolvedValue(null);
      await expect(service.create({ auditId: 'audit-in-dept-b', title: 'x', severity: 'MINOR_NC' }, ACTOR, pilotDeptA)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.finding.create).not.toHaveBeenCalled();
    });

    it('denies updating a finding whose audit belongs to another department', async () => {
      prisma.finding.findUnique.mockResolvedValue({ id: 'f1', audit: { departmentId: 'dept-b' } });
      await expect(service.update('f1', { title: 'x' }, ACTOR, pilotDeptA)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.finding.update).not.toHaveBeenCalled();
    });

    it('denies removing a finding whose audit belongs to another department', async () => {
      prisma.finding.findUnique.mockResolvedValue({ id: 'f1', audit: { departmentId: 'dept-b' } });
      await expect(service.remove('f1', pilotDeptA)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.finding.delete).not.toHaveBeenCalled();
    });

    it('allows a global Audit Manager to read/update/remove findings across departments', async () => {
      const managerGlobal: DataScope = { role: 'audit-manager', departmentId: null, isGlobal: true };
      prisma.audit.findFirst.mockResolvedValue({ id: 'audit-in-dept-b', departmentId: 'dept-b', processId: null });
      prisma.finding.findMany.mockResolvedValue([]);
      await expect(service.listByAudit('audit-in-dept-b', managerGlobal)).resolves.toEqual([]);

      prisma.finding.findUnique.mockResolvedValue({ id: 'f1', audit: { departmentId: 'dept-b' } });
      prisma.finding.update.mockResolvedValue({
        id: 'f1', auditId: 'audit-in-dept-b', questionId: null, title: 'y', description: null, severity: 'MINOR_NC',
        responsibleUserId: null, dueDate: null, status: 'OPEN', processId: null, comments: null,
        createdAt: new Date(0), updatedAt: new Date(0), responsible: null,
      });
      await expect(service.update('f1', { title: 'y' }, ACTOR, managerGlobal)).resolves.toMatchObject({ title: 'y' });
    });
  });
});

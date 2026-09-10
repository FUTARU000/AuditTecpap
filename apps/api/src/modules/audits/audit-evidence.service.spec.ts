import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DataScope } from '../../common/types/data-scope';
import type { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { StorageService } from '../storage/storage.service';
import { AuditEvidenceService } from './audit-evidence.service';

const ACTOR = { actorId: 'pilot-a', ipAddress: null, userAgent: null };

const pilotDeptA: DataScope = { role: 'pilot', departmentId: 'dept-a', isGlobal: false };
const managerGlobal: DataScope = { role: 'audit-manager', departmentId: null, isGlobal: true };

/**
 * Regression coverage for the department-scope / IDOR fix: sub-resource
 * access to audit evidence must be scoped through the parent audit's
 * department, exactly like every other repository-layer query in the app.
 */
describe('AuditEvidenceService — department isolation', () => {
  type MockFn = ReturnType<typeof vi.fn>;
  let service: AuditEvidenceService;
  let prisma: { audit: { findFirst: MockFn }; auditEvidence: { findMany: MockFn; findUnique: MockFn; delete: MockFn; create: MockFn } };
  let storage: { presignedDownloadUrl: MockFn; deleteObject: MockFn; putObject: MockFn };

  beforeEach(() => {
    prisma = {
      audit: { findFirst: vi.fn() },
      auditEvidence: { findMany: vi.fn(), findUnique: vi.fn(), delete: vi.fn(), create: vi.fn() },
    };
    storage = {
      presignedDownloadUrl: vi.fn().mockResolvedValue('https://minio.local/signed'),
      deleteObject: vi.fn().mockResolvedValue(undefined),
      putObject: vi.fn(),
    };
    service = new AuditEvidenceService(
      prisma as unknown as PrismaService,
      storage as unknown as StorageService,
      { record: vi.fn() } as unknown as ActivityTimelineService,
    );
  });

  describe('listByAudit', () => {
    it('denies a Pilot listing evidence for an audit outside their department', async () => {
      prisma.audit.findFirst.mockResolvedValue(null); // Prisma's departmentId filter excluded it
      await expect(service.listByAudit('audit-in-dept-b', pilotDeptA)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.audit.findFirst).toHaveBeenCalledWith({ where: { id: 'audit-in-dept-b', departmentId: 'dept-a' } });
      expect(prisma.auditEvidence.findMany).not.toHaveBeenCalled();
    });

    it('allows a Pilot to list evidence for an audit in their own department', async () => {
      prisma.audit.findFirst.mockResolvedValue({ id: 'audit-1', departmentId: 'dept-a' });
      prisma.auditEvidence.findMany.mockResolvedValue([]);
      await expect(service.listByAudit('audit-1', pilotDeptA)).resolves.toEqual([]);
    });

    it('allows a global Audit Manager to list evidence for any department', async () => {
      prisma.audit.findFirst.mockResolvedValue({ id: 'audit-in-dept-b', departmentId: 'dept-b' });
      prisma.auditEvidence.findMany.mockResolvedValue([]);
      await expect(service.listByAudit('audit-in-dept-b', managerGlobal)).resolves.toEqual([]);
      expect(prisma.audit.findFirst).toHaveBeenCalledWith({ where: { id: 'audit-in-dept-b' } });
    });
  });

  describe('downloadUrl', () => {
    it('denies a Pilot downloading evidence that belongs to another department', async () => {
      prisma.auditEvidence.findUnique.mockResolvedValue({ id: 'ev-1', auditId: 'audit-in-dept-b', fileKey: 'k' });
      prisma.audit.findFirst.mockResolvedValue(null);
      await expect(service.downloadUrl('ev-1', pilotDeptA)).rejects.toBeInstanceOf(NotFoundException);
      expect(storage.presignedDownloadUrl).not.toHaveBeenCalled();
    });

    it('denies download when evidence has no audit link (fails closed)', async () => {
      prisma.auditEvidence.findUnique.mockResolvedValue({ id: 'ev-2', auditId: null, fileKey: 'k' });
      await expect(service.downloadUrl('ev-2', pilotDeptA)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('allows a Pilot to download evidence within their own department', async () => {
      prisma.auditEvidence.findUnique.mockResolvedValue({ id: 'ev-3', auditId: 'audit-1', fileKey: 'k' });
      prisma.audit.findFirst.mockResolvedValue({ id: 'audit-1', departmentId: 'dept-a' });
      await expect(service.downloadUrl('ev-3', pilotDeptA)).resolves.toEqual({ url: 'https://minio.local/signed' });
    });

    it('allows a global Audit Manager to download evidence from any department', async () => {
      prisma.auditEvidence.findUnique.mockResolvedValue({ id: 'ev-4', auditId: 'audit-in-dept-b', fileKey: 'k' });
      await expect(service.downloadUrl('ev-4', managerGlobal)).resolves.toEqual({ url: 'https://minio.local/signed' });
      expect(prisma.audit.findFirst).not.toHaveBeenCalled(); // global scope short-circuits, no extra query needed
    });
  });

  describe('remove', () => {
    it('denies a Pilot deleting evidence that belongs to another department', async () => {
      prisma.auditEvidence.findUnique.mockResolvedValue({ id: 'ev-1', auditId: 'audit-in-dept-b', fileKey: 'k', fileName: 'f.pdf' });
      prisma.audit.findFirst.mockResolvedValue(null);
      await expect(service.remove('ev-1', ACTOR, pilotDeptA)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.auditEvidence.delete).not.toHaveBeenCalled();
      expect(storage.deleteObject).not.toHaveBeenCalled();
    });

    it('allows a Pilot to delete evidence within their own department', async () => {
      prisma.auditEvidence.findUnique.mockResolvedValue({ id: 'ev-1', auditId: 'audit-1', fileKey: 'k', fileName: 'f.pdf' });
      prisma.audit.findFirst.mockResolvedValue({ id: 'audit-1', departmentId: 'dept-a' });
      await service.remove('ev-1', ACTOR, pilotDeptA);
      expect(prisma.auditEvidence.delete).toHaveBeenCalledWith({ where: { id: 'ev-1' } });
    });
  });
});

import { ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import type { AuditLogService } from '../audit-log/audit-log.service';
import type { PrismaService } from '../prisma/prisma.service';
import { CapaService } from './capa.service';

const ACTOR = { actorId: 'u1', ipAddress: null, userAgent: null };

describe('CapaService (workflow + transitions)', () => {
  type MockFn = ReturnType<typeof vi.fn>;
  let service: CapaService;
  let prisma: { capa: { findFirst: MockFn; findUnique: MockFn; findMany: MockFn; count: MockFn; create: MockFn; update: MockFn; aggregate: MockFn }; capaRootCauseAnalysis: { upsert: MockFn }; capaWhyStep: { create: MockFn; delete: MockFn }; capaEightD: { upsert: MockFn }; capaVerification: { upsert: MockFn }; capaEffectivenessReview: { upsert: MockFn } };

  beforeEach(() => {
    prisma = {
      capa: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn().mockResolvedValue(0), create: vi.fn(), update: vi.fn(), aggregate: vi.fn() },
      capaRootCauseAnalysis: { upsert: vi.fn() },
      capaWhyStep: { create: vi.fn(), delete: vi.fn() },
      capaEightD: { upsert: vi.fn() },
      capaVerification: { upsert: vi.fn() },
      capaEffectivenessReview: { upsert: vi.fn() },
    };
    service = new CapaService(prisma as unknown as PrismaService, { record: vi.fn() } as unknown as AuditLogService, { record: vi.fn() } as unknown as ActivityTimelineService);
  });

  it('rejects invalid status transition (DRAFT → CLOSED)', async () => {
    prisma.capa.findFirst.mockResolvedValue({ id: 'c1', status: 'DRAFT', referenceNumber: 'CAPA-2026-0001', processId: null, openedAt: null, actions: [], verification: null, effectiveness: null });
    await expect(service.transition('c1', 'CLOSED', ACTOR)).rejects.toBeInstanceOf(ConflictException);
  });

  it('allows valid transition (DRAFT → ROOT_CAUSE_ANALYSIS)', async () => {
    prisma.capa.findFirst.mockResolvedValue({ id: 'c1', status: 'DRAFT', referenceNumber: 'CAPA-2026-0001', processId: null, openedAt: null, actions: [], verification: null, effectiveness: null });
    prisma.capa.update.mockResolvedValue({ id: 'c1', status: 'ROOT_CAUSE_ANALYSIS', referenceNumber: 'CAPA-2026-0001', title: 'T', description: null, sourceType: 'MANUAL', sourceId: null, findingId: null, departmentId: 'd1', processId: null, ownerId: null, createdById: 'u1', priority: 'MEDIUM', targetDate: null, openedAt: null, submittedAt: null, verifiedAt: null, effectivenessDueDate: null, effectivenessReviewedAt: null, closedAt: null, closedById: null, closureComment: null, deletedAt: null, createdAt: new Date(0), updatedAt: new Date(0), department: { name: 'D' }, process: null, owner: null, createdBy: { firstName: 'A', lastName: 'B' }, closedBy: null, finding: null, rootCause: { id: 'r1', problemStatement: null, immediateCause: null, rootCause: null, contributingFactors: null, analysisNotes: null, useFiveWhys: false, useEightD: false, whySteps: [], eightD: null }, actions: [], verification: null, effectiveness: null });
    await service.transition('c1', 'ROOT_CAUSE_ANALYSIS', ACTOR);
    expect(prisma.capa.update).toHaveBeenCalled();
  });

  it('prevents closure without verification', async () => {
    prisma.capa.findFirst.mockResolvedValue({ id: 'c1', status: 'PENDING_EFFECTIVENESS', referenceNumber: 'CAPA-2026-0001', processId: null, openedAt: null, actions: [], verification: { result: 'PASSED' }, effectiveness: { result: 'INEFFECTIVE' } });
    await expect(service.transition('c1', 'CLOSED', ACTOR)).rejects.toBeInstanceOf(ConflictException);
  });

  it('generates sequential reference numbers', async () => {
    prisma.capa.count.mockResolvedValue(3);
    prisma.capa.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ ...data, id: 'c1', status: 'DRAFT', referenceNumber: 'CAPA-2026-0004', department: { name: 'D' }, process: null, owner: null, createdBy: null, closedBy: null, finding: null, rootCause: { id: 'r1', problemStatement: null, immediateCause: null, rootCause: null, contributingFactors: null, analysisNotes: null, useFiveWhys: false, useEightD: false, whySteps: [], eightD: null }, actions: [], verification: null, effectiveness: null, createdAt: new Date(0), updatedAt: new Date(0), openedAt: null, submittedAt: null, verifiedAt: null, effectivenessDueDate: null, effectivenessReviewedAt: null, closedAt: null, closedById: null, closureComment: null, deletedAt: null, departmentId: 'd1', processId: null, ownerId: null, createdById: 'u1', priority: 'MEDIUM', targetDate: null, sourceType: 'MANUAL', sourceId: null, findingId: null }));
    const capa = await service.create({ title: 'Test', departmentId: 'd1' }, ACTOR);
    expect(capa.referenceNumber).toBe('CAPA-2026-0004');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import type { AuditLogService } from '../audit-log/audit-log.service';
import type { PrismaService } from '../prisma/prisma.service';
import { ProcessRisksService } from './process-risks.service';

const ACTOR = { actorId: 'u1', ipAddress: null, userAgent: null };

describe('ProcessRisksService (risk scoring)', () => {
  type MockFn = ReturnType<typeof vi.fn>;
  let service: ProcessRisksService;
  let prisma: { process: { findFirst: MockFn }; processRisk: { findUnique: MockFn; findMany: MockFn; count: MockFn; create: MockFn; update: MockFn; delete: MockFn } };

  beforeEach(() => {
    prisma = {
      process: { findFirst: vi.fn().mockResolvedValue({ id: 'p1' }) },
      processRisk: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    };
    service = new ProcessRisksService(prisma as unknown as PrismaService, { record: vi.fn() } as unknown as AuditLogService, { record: vi.fn() } as unknown as ActivityTimelineService);
  });

  it('computes riskScore = probability × impact on create', async () => {
    prisma.processRisk.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ ...data, id: 'r1', processId: 'p1', ownerId: null, owner: null, createdAt: new Date(0), updatedAt: new Date(0) }),
    );
    const risk = await service.create({ processId: 'p1', title: 'Fire hazard', probability: 4, impact: 5 }, ACTOR);
    expect(risk.riskScore).toBe(20);
    expect(prisma.processRisk.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ riskScore: 20 }) }));
  });

  it('recomputes riskScore on update', async () => {
    prisma.processRisk.findUnique.mockResolvedValue({ id: 'r1', probability: 3, impact: 3 });
    prisma.processRisk.update.mockImplementation(({ data }: { data: Record<string, number> }) =>
      Promise.resolve({ id: 'r1', processId: 'p1', title: 'T', description: null, probability: 5, impact: 5, riskScore: data.riskScore, ownerId: null, owner: null, mitigation: null, reviewDate: null, status: 'OPEN', createdAt: new Date(0), updatedAt: new Date(0) }),
    );
    const updated = await service.update('r1', { probability: 5, impact: 5 }, ACTOR);
    expect(updated.riskScore).toBe(25);
  });
});

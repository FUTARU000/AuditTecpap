import { describe, expect, it, vi } from 'vitest';
import type { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import type { AuditLogService } from '../audit-log/audit-log.service';
import type { PrismaService } from '../prisma/prisma.service';
import { KpisService } from './kpis.service';

const ACTOR = { actorId: 'u1', ipAddress: null, userAgent: null };

describe('KpisService (record value)', () => {
  it('records a measurement and returns the updated DTO', async () => {
    const update = vi.fn().mockImplementation(({ data }: { data: { currentValue: number; trend: string | null } }) =>
      Promise.resolve({
        id: 'k1', name: 'Yield', description: null, formula: null, unit: '%', target: 95, warningThreshold: null, criticalThreshold: null,
        currentValue: data.currentValue, trend: data.trend ?? null, frequency: 'MONTHLY', status: 'ACTIVE',
        responsibleUserId: null, responsible: null, departmentId: null, department: null, processId: null, process: null,
        createdAt: new Date(0), updatedAt: new Date(0),
      }),
    );
    const prisma = { kpi: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update, delete: vi.fn() } };
    const service = new KpisService(prisma as unknown as PrismaService, { record: vi.fn() } as unknown as AuditLogService, { record: vi.fn() } as unknown as ActivityTimelineService);

    const kpi = await service.recordValue('k1', { currentValue: 92 }, ACTOR);
    expect(kpi.currentValue).toBe(92);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ currentValue: 92 }) }));
  });
});

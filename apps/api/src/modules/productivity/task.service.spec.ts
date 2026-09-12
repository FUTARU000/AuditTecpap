import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import { TaskService } from './task.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-09-12T00:00:00.000Z');

describe('TaskService.cleanupCompleted — 30-day auto-hide boundary', () => {
  type MockFn = ReturnType<typeof vi.fn>;
  let service: TaskService;
  let prisma: { userTask: { updateMany: MockFn } };

  beforeEach(() => {
    prisma = { userTask: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) } };
    service = new TaskService(prisma as unknown as PrismaService);
  });

  it('retains a task completed 29 days ago (below the retention window)', async () => {
    await service.cleanupCompleted(NOW);
    const where = prisma.userTask.updateMany.mock.calls[0]![0].where;
    const completed29DaysAgo = new Date(NOW.getTime() - 29 * DAY_MS);
    // The query's cutoff must be strictly before a 29-day-old completion, i.e. that row is NOT matched.
    expect(completed29DaysAgo.getTime()).toBeGreaterThan(where.completedAt.lte.getTime());
  });

  it('hides a task completed exactly 30 days ago (inclusive boundary)', async () => {
    await service.cleanupCompleted(NOW);
    const where = prisma.userTask.updateMany.mock.calls[0]![0].where;
    const completedExactly30DaysAgo = new Date(NOW.getTime() - 30 * DAY_MS);
    expect(completedExactly30DaysAgo.getTime()).toBe(where.completedAt.lte.getTime());
  });

  it('hides a task completed 31 days ago', async () => {
    await service.cleanupCompleted(NOW);
    const where = prisma.userTask.updateMany.mock.calls[0]![0].where;
    const completed31DaysAgo = new Date(NOW.getTime() - 31 * DAY_MS);
    expect(completed31DaysAgo.getTime()).toBeLessThanOrEqual(where.completedAt.lte.getTime());
  });

  it('never touches unchecked (completedAt: null) tasks — filters on completedAt not null', async () => {
    await service.cleanupCompleted(NOW);
    const where = prisma.userTask.updateMany.mock.calls[0]![0].where;
    expect(where.completedAt.not).toBeNull();
  });

  it('never re-processes a task it already hid — only targets dismissedAt: null', async () => {
    await service.cleanupCompleted(NOW);
    const where = prisma.userTask.updateMany.mock.calls[0]![0].where;
    expect(where.dismissedAt).toBeNull();
  });

  it('sets dismissedAt (the existing "hide from list() forever" flag), never deletes the row', async () => {
    await service.cleanupCompleted(NOW);
    const data = prisma.userTask.updateMany.mock.calls[0]![0].data;
    expect(data.dismissedAt).toEqual(NOW);
  });

  it('is idempotent: a second run with the same clock finds nothing new (updateMany naturally reports 0 once dismissedAt is set)', async () => {
    prisma.userTask.updateMany
      .mockResolvedValueOnce({ count: 3 })
      .mockResolvedValueOnce({ count: 0 });
    const first = await service.cleanupCompleted(NOW);
    const second = await service.cleanupCompleted(NOW);
    expect(first.count).toBe(3);
    expect(second.count).toBe(0);
    expect(prisma.userTask.updateMany).toHaveBeenCalledTimes(2);
  });
});

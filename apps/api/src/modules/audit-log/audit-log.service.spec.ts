import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditLogService } from './audit-log.service';

describe('AuditLogService (immutable / append-only)', () => {
  let prisma: { auditLog: { create: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn>; count: ReturnType<typeof vi.fn> } };
  let service: AuditLogService;

  beforeEach(() => {
    prisma = {
      auditLog: {
        create: vi.fn().mockResolvedValue({}),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
    };
    service = new AuditLogService(prisma as never);
  });

  it('persists an entry through prisma.auditLog.create', async () => {
    await service.record({
      actorId: 'u1',
      action: 'user.create',
      entityType: 'user',
      entityId: 'u2',
      ipAddress: '10.0.0.1',
      userAgent: 'test',
      metadata: { source: 'test' },
    });

    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'user.create',
        entityType: 'user',
        entityId: 'u2',
        actorId: 'u1',
        ipAddress: '10.0.0.1',
      }),
    });
  });

  it('exposes NO update or delete path (immutability by design)', () => {
    expect((service as unknown as Record<string, unknown>).update).toBeUndefined();
    expect((service as unknown as Record<string, unknown>).delete).toBeUndefined();
    expect((service as unknown as Record<string, unknown>).remove).toBeUndefined();
  });

  it('returns a paginated result from list()', async () => {
    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: 'a1',
        actorId: 'u1',
        action: 'user.create',
        entityType: 'user',
        entityId: 'u2',
        target: 'a@b.c',
        ipAddress: null,
        userAgent: null,
        metadata: null,
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        actor: { firstName: 'A', lastName: 'B', email: 'a@b.c' },
      },
    ]);
    prisma.auditLog.count.mockResolvedValue(1);

    const result = await service.list({ page: '1', pageSize: '10' });
    expect(result.total).toBe(1);
    expect(result.items[0]?.actorName).toBe('A B');
    expect(result.items[0]?.createdAt).toBe('2025-01-01T00:00:00.000Z');
  });
});

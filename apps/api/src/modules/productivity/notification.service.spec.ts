import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EmailProvider } from './email-provider.interface';
import type { AuditLogService } from '../audit-log/audit-log.service';
import type { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  type MockFn = ReturnType<typeof vi.fn>;
  let service: NotificationService;
  let prisma: { notification: { findFirst: MockFn; create: MockFn; update: MockFn; updateMany: MockFn; count: MockFn; findUnique: MockFn; delete: MockFn }; user: { findUnique: MockFn } };
  let email: { send: MockFn };
  let auditLog: { record: MockFn };

  beforeEach(() => {
    prisma = {
      notification: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), count: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
      user: { findUnique: vi.fn().mockResolvedValue({ email: 'u@tecpap.ma' }) },
    };
    email = { send: vi.fn().mockResolvedValue(undefined) };
    auditLog = { record: vi.fn().mockResolvedValue(undefined) };
    service = new NotificationService(prisma as unknown as PrismaService, auditLog as unknown as AuditLogService, email as unknown as EmailProvider);
  });

  it('creates a notification and delivers via email when no recent duplicate exists', async () => {
    prisma.notification.findFirst.mockResolvedValue(null);
    prisma.notification.create.mockResolvedValue({ id: 'n1', type: 'CAPA_OVERDUE', category: 'capa', severity: 'CRITICAL', title: 'T', message: 'M', entityType: 'capa', entityId: 'c1', actionUrl: null, departmentId: null, readAt: null, archivedAt: null, createdAt: new Date(0) });

    const dto = await service.emit({ userId: 'u1', type: 'CAPA_OVERDUE', category: 'capa', title: 'T', message: 'M', entityType: 'capa', entityId: 'c1' });

    expect(dto?.id).toBe('n1');
    expect(prisma.notification.create).toHaveBeenCalledOnce();
    expect(email.send).toHaveBeenCalledOnce();
    expect(auditLog.record).toHaveBeenCalledOnce();
  });

  it('dedups within the window — skips create when the same event was already sent', async () => {
    prisma.notification.findFirst.mockResolvedValue({ id: 'existing' });

    const dto = await service.emit({ userId: 'u1', type: 'CAPA_OVERDUE', category: 'capa', title: 'T', message: 'M', entityId: 'c1' });

    expect(dto).toBeNull();
    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(email.send).not.toHaveBeenCalled();
  });

  it('counts only unread, non-archived notifications', async () => {
    prisma.notification.count.mockResolvedValue(3);
    await expect(service.unreadCount('u1')).resolves.toBe(3);
    expect(prisma.notification.count).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: 'u1', readAt: null, archivedAt: null }) }));
  });
});

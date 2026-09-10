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

  describe('Phase 5 — structured localization (type + params)', () => {
    it('a templated type with params stores the English rendering plus the raw params (stable metadata)', async () => {
      prisma.notification.findFirst.mockResolvedValue(null);
      prisma.notification.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'n1', ...data, createdAt: new Date(0) }));

      const dto = await service.emit({ userId: 'u1', type: 'CAPA_VALIDATED', category: 'capa', params: { reference: 'CAPA-2026-0001', title: 'Spill containment' }, entityType: 'capa_verification', entityId: 'v1' });

      expect(dto?.title).toBe('CAPA validated: CAPA-2026-0001');
      expect(dto?.message).toBe('Spill containment passed verification and is now validated.');
      expect(dto?.params).toEqual({ reference: 'CAPA-2026-0001', title: 'Spill containment' });
      expect(prisma.notification.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ params: { reference: 'CAPA-2026-0001', title: 'Spill containment' } }) }));
    });

    it('still targets the correct user when using params instead of literal text', async () => {
      prisma.notification.findFirst.mockResolvedValue(null);
      prisma.notification.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'n1', ...data, createdAt: new Date(0) }));
      await service.emit({ userId: 'pilot-42', type: 'CAPA_RETURNED', category: 'capa', params: { reference: 'CAPA-2026-0002', title: 'X' } });
      expect(prisma.notification.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: 'pilot-42' }) }));
    });

    it('a type with no registered template still works via literal title/message (e.g. free-text comment mentions)', async () => {
      prisma.notification.findFirst.mockResolvedValue(null);
      prisma.notification.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'n1', ...data, createdAt: new Date(0) }));

      const dto = await service.emit({ userId: 'u1', type: 'COMMENT_MENTION', category: 'document', title: 'You were mentioned in DOC-1', message: 'Please check this out' });

      expect(dto?.title).toBe('You were mentioned in DOC-1');
      expect(dto?.params).toBeNull();
      expect(prisma.notification.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ params: undefined }) }));
    });

    it('throws when a type has no template and no literal title/message is provided (fail loudly, not silently)', async () => {
      prisma.notification.findFirst.mockResolvedValue(null);
      await expect(service.emit({ userId: 'u1', type: 'COMMENT_MENTION', category: 'document' })).rejects.toThrow(/no template/i);
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it('a legacy row with no params (created before Phase 5) maps to params: null, not an error', async () => {
      prisma.notification.findFirst.mockResolvedValue(null);
      prisma.notification.create.mockResolvedValue({ id: 'n-legacy', type: 'CAPA_OVERDUE', category: 'capa', severity: 'CRITICAL', title: 'Legacy title', message: 'Legacy message', entityType: null, entityId: null, actionUrl: null, departmentId: null, readAt: null, archivedAt: null, createdAt: new Date(0) });
      const dto = await service.emit({ userId: 'u1', type: 'CAPA_OVERDUE', category: 'capa', title: 'Legacy title', message: 'Legacy message' });
      expect(dto?.params).toBeNull();
      expect(dto?.title).toBe('Legacy title');
    });

    it('email delivery still receives the rendered English subject/body when using params', async () => {
      prisma.notification.findFirst.mockResolvedValue(null);
      prisma.notification.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'n1', ...data, createdAt: new Date(0) }));
      await service.emit({ userId: 'u1', type: 'CAPA_VALIDATED', category: 'capa', params: { reference: 'CAPA-2026-0009', title: 'Y' } });
      expect(email.send).toHaveBeenCalledWith(expect.objectContaining({ subject: 'CAPA validated: CAPA-2026-0009', body: 'Y passed verification and is now validated.' }));
    });

    it('dedup still works when the notification is created via params', async () => {
      prisma.notification.findFirst.mockResolvedValue({ id: 'existing' });
      const dto = await service.emit({ userId: 'u1', type: 'CAPA_RETURNED', category: 'capa', entityId: 'v1', params: { reference: 'CAPA-2026-0001', title: 'X' } });
      expect(dto).toBeNull();
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });
  });
});

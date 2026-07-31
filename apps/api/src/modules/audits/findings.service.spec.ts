import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import type { AuditLogService } from '../audit-log/audit-log.service';
import type { PrismaService } from '../prisma/prisma.service';
import { FindingsService } from './findings.service';

const ACTOR = { actorId: 'u1', ipAddress: null, userAgent: null };

describe('FindingsService', () => {
  type MockFn = ReturnType<typeof vi.fn>;
  let service: FindingsService;
  let prisma: { audit: { findUnique: MockFn }; finding: { findMany: MockFn; create: MockFn; findUnique: MockFn; update: MockFn; delete: MockFn } };

  beforeEach(() => {
    prisma = { audit: { findUnique: vi.fn().mockResolvedValue({ id: 'a1', processId: 'p1' }) }, finding: { findMany: vi.fn(), create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() } };
    service = new FindingsService(prisma as unknown as PrismaService, { record: vi.fn() } as unknown as AuditLogService, { record: vi.fn() } as unknown as ActivityTimelineService);
  });

  it('creates a finding linked to the audit process', async () => {
    prisma.finding.create.mockResolvedValue({
      id: 'f1', auditId: 'a1', questionId: null, title: 'Oil leak', description: null, severity: 'MAJOR_NC',
      responsibleUserId: null, dueDate: null, status: 'OPEN', processId: 'p1', comments: null,
      createdAt: new Date(0), updatedAt: new Date(0), responsible: null,
    });
    const finding = await service.create({ auditId: 'a1', title: 'Oil leak', severity: 'MAJOR_NC' }, ACTOR);
    expect(finding.severity).toBe('MAJOR_NC');
    expect(finding.processId).toBe('p1');
    expect(prisma.finding.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ severity: 'MAJOR_NC', processId: 'p1' }) }));
  });
});

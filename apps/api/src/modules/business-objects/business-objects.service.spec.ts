import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import type { AuditLogService } from '../audit-log/audit-log.service';
import type { PrismaService } from '../prisma/prisma.service';
import { BusinessObjectsService } from './business-objects.service';

const ACTOR = { actorId: 'u1', ipAddress: null, userAgent: null };

describe('BusinessObjectsService (uniqueness)', () => {
  it('rejects a duplicate code within a department', async () => {
    const prisma = {
      businessObjectType: { findUnique: vi.fn().mockResolvedValue({ id: 't1' }) },
      department: { findUnique: vi.fn().mockResolvedValue({ id: 'd1' }) },
      process: { findFirst: vi.fn() },
      businessObject: { findUnique: vi.fn().mockResolvedValue({ id: 'existing' }), findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() },
    };
    const service = new BusinessObjectsService(prisma as unknown as PrismaService, { record: vi.fn() } as unknown as AuditLogService, { record: vi.fn() } as unknown as ActivityTimelineService);

    await expect(service.create({ typeId: 't1', departmentId: 'd1', name: 'X', code: 'DUP' }, ACTOR)).rejects.toBeInstanceOf(ConflictException);
  });
});

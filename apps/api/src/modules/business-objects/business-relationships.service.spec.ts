import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AuditLogService } from '../audit-log/audit-log.service';
import type { PrismaService } from '../prisma/prisma.service';
import { BusinessRelationshipsService } from './business-relationships.service';

const ACTOR = { actorId: 'u1', ipAddress: null, userAgent: null };

describe('BusinessRelationshipsService', () => {
  it('throws Conflict when the relationship already exists', async () => {
    const create = vi.fn().mockRejectedValue(new Error('unique constraint'));
    const prisma = { businessRelationship: { findMany: vi.fn(), create, findUnique: vi.fn(), delete: vi.fn() } };
    const service = new BusinessRelationshipsService(prisma as unknown as PrismaService, { record: vi.fn() } as unknown as AuditLogService);

    await expect(
      service.create({ sourceType: 'document', sourceId: 'd1', targetType: 'risk', targetId: 'r1', type: 'REFERENCES' }, ACTOR),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

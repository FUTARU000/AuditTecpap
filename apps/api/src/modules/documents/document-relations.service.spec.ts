import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditLogService } from '../audit-log/audit-log.service';
import type { PrismaService } from '../prisma/prisma.service';
import { DocumentRelationsService } from './document-relations.service';

const ACTOR = { actorId: 'u1', ipAddress: null, userAgent: null };

describe('DocumentRelationsService', () => {
  type MockFn = ReturnType<typeof vi.fn>;
  let service: DocumentRelationsService;
  let prisma: { documentRelation: { findMany: MockFn; create: MockFn; findFirst: MockFn; delete: MockFn }; controlledDocument: { findFirst: MockFn } };

  beforeEach(() => {
    prisma = {
      documentRelation: { findMany: vi.fn(), create: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
      controlledDocument: { findFirst: vi.fn() },
    };
    service = new DocumentRelationsService(prisma as unknown as PrismaService, { record: vi.fn() } as unknown as AuditLogService);
  });

  it('rejects a self-reference', async () => {
    await expect(service.add('d1', { targetDocumentId: 'd1', type: 'REFERENCES' }, ACTOR)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists relations mapped to the DTO shape', async () => {
    prisma.documentRelation.findMany.mockResolvedValue([
      { id: 'r1', sourceDocumentId: 'd1', targetDocumentId: 'd2', type: 'USES', createdAt: new Date(0), targetDocument: { id: 'd2', title: 'Form A', code: 'F-1', status: 'PUBLISHED' } },
    ]);
    const list = await service.list('d1');
    expect(list[0]?.targetTitle).toBe('Form A');
    expect(list[0]?.targetCode).toBe('F-1');
    expect(list[0]?.type).toBe('USES');
  });

  it('throws NotFound when removing an unknown relation', async () => {
    prisma.documentRelation.findFirst.mockResolvedValue(null);
    await expect(service.remove('d1', 'missing', ACTOR)).rejects.toBeInstanceOf(Error);
  });
});

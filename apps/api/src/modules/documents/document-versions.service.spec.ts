import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditLogService } from '../audit-log/audit-log.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { StorageService } from '../storage/storage.service';
import { DocumentVersionsService } from './document-versions.service';

const ACTOR = { actorId: 'u1', ipAddress: null, userAgent: null };

describe('DocumentVersionsService (upload validation)', () => {
  type MockFn = ReturnType<typeof vi.fn>;
  let service: DocumentVersionsService;
  let prisma: { controlledDocument: { findFirst: MockFn; findUnique: MockFn; update: MockFn }; documentVersion: { findFirst: MockFn; findMany: MockFn; create: MockFn }; $transaction: MockFn };
  let storage: { putObject: MockFn; presignedDownloadUrl: MockFn; deleteObject: MockFn };

  beforeEach(() => {
    prisma = {
      controlledDocument: { findFirst: vi.fn().mockResolvedValue({ id: 'd1' }), findUnique: vi.fn(), update: vi.fn() },
      documentVersion: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn(), create: vi.fn() },
      $transaction: vi.fn(),
    };
    storage = { putObject: vi.fn().mockResolvedValue(undefined), presignedDownloadUrl: vi.fn(), deleteObject: vi.fn() };
    service = new DocumentVersionsService(
      prisma as unknown as PrismaService,
      storage as unknown as StorageService,
      { record: vi.fn() } as unknown as AuditLogService,
    );
  });

  it('rejects unsupported file types', async () => {
    await expect(
      service.create('d1', { originalname: 'malware.exe', buffer: Buffer.from('x'), mimetype: 'application/octet-stream', size: 10 }, { version: '1.0' }, ACTOR),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it('rejects files over the size limit', async () => {
    await expect(
      service.create('d1', { originalname: 'big.pdf', buffer: Buffer.alloc(1), mimetype: 'application/pdf', size: 60 * 1024 * 1024 }, { version: '1.0' }, ACTOR),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

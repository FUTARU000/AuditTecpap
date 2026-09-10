import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import { DuplicateDetector } from './duplicate.detector';

describe('DuplicateDetector — unchanged by Google Drive integration (16)', () => {
  function build(overrides: { documentVersion?: unknown; controlledDocument?: unknown } = {}) {
    const prisma = {
      documentVersion: { findFirst: vi.fn().mockResolvedValue(null), ...(overrides.documentVersion as object) },
      controlledDocument: { findFirst: vi.fn().mockResolvedValue(null), ...(overrides.controlledDocument as object) },
    };
    return { detector: new DuplicateDetector(prisma as unknown as PrismaService), prisma };
  }

  it('flags a checksum match against any existing version as a true duplicate, regardless of source', async () => {
    const { detector, prisma } = build({ documentVersion: { findFirst: vi.fn().mockResolvedValue({ documentId: 'doc-1' }) } });
    const result = await detector.detect('abc123', null);
    expect(result.checksumDuplicateDocId).toBe('doc-1');
    expect(prisma.documentVersion.findFirst).toHaveBeenCalledWith({ where: { checksum: 'abc123' }, select: { documentId: true } });
  });

  it('flags a document-code match (non-deleted) as a version conflict', async () => {
    const { detector } = build({ controlledDocument: { findFirst: vi.fn().mockResolvedValue({ id: 'doc-2' }) } });
    const result = await detector.detect(null, 'PROC-014');
    expect(result.codeConflictDocId).toBe('doc-2');
  });

  it('returns no duplicate when checksum and code are both novel', async () => {
    const { detector } = build();
    const result = await detector.detect('new-checksum', 'PROC-999');
    expect(result).toEqual({ checksumDuplicateDocId: null, codeConflictDocId: null });
  });

  it('skips lookups entirely when checksum/code are not provided (e.g. Drive export produced neither)', async () => {
    const { detector, prisma } = build();
    const result = await detector.detect(null, null);
    expect(result).toEqual({ checksumDuplicateDocId: null, codeConflictDocId: null });
    expect(prisma.documentVersion.findFirst).not.toHaveBeenCalled();
    expect(prisma.controlledDocument.findFirst).not.toHaveBeenCalled();
  });
});

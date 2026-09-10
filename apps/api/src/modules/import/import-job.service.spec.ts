import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import type { StorageService } from '../storage/storage.service';
import type { AuditLogService } from '../audit-log/audit-log.service';
import type { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import type { ParserRegistry } from './parser.registry';
import type { ImportScanner } from './import-scanner';
import type { MetadataExtractor } from './metadata-extractor';
import type { ClassificationEngine } from './classification.engine';
import type { DuplicateDetector } from './duplicate.detector';
import type { ImportStatisticsService } from './import-statistics.service';
import type { RelationshipResolver } from './relationship.resolver';
import { ImportJobService } from './import-job.service';

const ACTOR = { actorId: 'u1', ipAddress: null, userAgent: null };

function jobRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'job-1', source: 'UPLOAD', sourceLocation: null, name: null, status: 'PENDING',
    startedById: 'u1', startedBy: { firstName: 'A', lastName: 'B' },
    progress: 0, processed: 0, imported: 0, skipped: 0, failed: 0, duplicates: 0, warnings: 0,
    errorMessage: null, stats: null, errors: null, cancelledAt: null, completedAt: null,
    createdAt: new Date(0), updatedAt: new Date(0),
    items: [],
    ...overrides,
  };
}

function build() {
  const prisma = {
    importJob: { create: vi.fn().mockResolvedValue(jobRow()), update: vi.fn().mockResolvedValue(jobRow()), findUnique: vi.fn().mockResolvedValue(jobRow()) },
    importItem: {
      create: vi.fn().mockResolvedValue({ id: 'item-1' }),
      groupBy: vi.fn().mockResolvedValue([{ status: 'SKIPPED', _count: 1 }]),
      findMany: vi.fn().mockImplementation(({ select }: { select?: { warnings?: boolean } }) => Promise.resolve(select?.warnings ? [] : [])),
      count: vi.fn().mockResolvedValue(0),
    },
    controlledDocument: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const registry = {} as ParserRegistry;
  const scanner = { scan: vi.fn() } as unknown as ImportScanner;
  const metadata = {} as MetadataExtractor;
  const classification = {} as ClassificationEngine;
  const duplicates = {} as DuplicateDetector;
  const stats = { jobStats: vi.fn().mockResolvedValue({ byDepartment: {}, byCategory: {}, byFormat: {}, byStatus: {}, averageProcessingMs: null, storageBytes: 0 }) } as unknown as ImportStatisticsService;
  const storage = { putObject: vi.fn().mockResolvedValue('key'), getObject: vi.fn() } as unknown as StorageService;
  const auditLog = { record: vi.fn().mockResolvedValue(undefined) } as unknown as AuditLogService;
  const timeline = { record: vi.fn().mockResolvedValue(undefined) } as unknown as ActivityTimelineService;
  const relationships = { resolve: vi.fn().mockResolvedValue(undefined) } as unknown as RelationshipResolver;

  const service = new ImportJobService(
    prisma as unknown as PrismaService, registry, scanner, metadata, classification, duplicates, stats, storage, auditLog, timeline, relationships,
  );
  return { service, prisma, scanner, storage, auditLog };
}

describe('ImportJobService — Google Drive wiring must not disturb existing behavior', () => {
  beforeEach(() => vi.clearAllMocks());

  it('14. runUpload still processes an unsupported-format file through create → skip → complete (unchanged pipeline)', async () => {
    const { service, prisma, storage } = build();
    prisma.importJob.create.mockResolvedValue(jobRow({ source: 'UPLOAD' }));

    const detail = await service.runUpload(ACTOR, [{ name: 'notes.txt', buffer: Buffer.from('hi'), mimeType: 'text/plain' }], 'My upload');

    expect(storage.putObject).toHaveBeenCalledOnce();
    expect(prisma.importItem.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'SKIPPED', fileName: 'notes.txt' }) }));
    expect(detail.id).toBe('job-1');
    // Nothing awaiting review + nothing imported → the job finalizes to COMPLETED automatically.
    expect(prisma.importJob.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED' }) }));
  });

  it('13. runScan(LOCAL, path) still calls the scanner with the exact same arguments as before', async () => {
    const { service, scanner, storage } = build();
    (scanner.scan as ReturnType<typeof vi.fn>).mockResolvedValue([
      { originalPath: 'a.txt', relativePath: 'a.txt', fileName: 'a.txt', extension: 'txt', mimeType: 'text/plain', sizeBytes: 2, parentFolder: null, read: () => Promise.resolve(Buffer.from('hi')) },
    ]);

    await service.runScan(ACTOR, 'LOCAL', '/mnt/legacy-qms', 'Legacy migration');

    expect(scanner.scan).toHaveBeenCalledWith('LOCAL', '/mnt/legacy-qms');
    expect(storage.putObject).toHaveBeenCalledOnce();
  });

  it('marks the job FAILED with a clear message when the scanner throws (Drive misconfiguration, inaccessible folder, etc.) instead of leaving it stuck PENDING', async () => {
    const { service, prisma, scanner } = build();
    (scanner.scan as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Google Drive is not configured (GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON is missing).'));

    await expect(service.runScan(ACTOR, 'GOOGLE_DRIVE', '', 'Drive import')).rejects.toThrow(/not configured/i);

    expect(prisma.importJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { status: 'FAILED', errorMessage: expect.stringMatching(/not configured/i) },
    });
  });

  it('still calls the scanner for GOOGLE_DRIVE exactly like it does for LOCAL (same code path, different provider)', async () => {
    const { service, scanner } = build();
    (scanner.scan as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    await service.runScan(ACTOR, 'GOOGLE_DRIVE', 'drive-folder-id', 'Drive import').catch(() => undefined);
    expect(scanner.scan).toHaveBeenCalledWith('GOOGLE_DRIVE', 'drive-folder-id');
  });
});

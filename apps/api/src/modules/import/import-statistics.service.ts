import { Injectable } from '@nestjs/common';
import type { DataScope } from '../../common/types/data-scope';
import type { ImportDashboardStatsDto, ImportJobStats } from '@tecpap/types';
import { PrismaService } from '../prisma/prisma.service';

/** Aggregate job + dashboard statistics, computed on demand from import_items. */
@Injectable()
export class ImportStatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Per-job roll-up stored on ImportJob.stats after completion. */
  async jobStats(jobId: string): Promise<ImportJobStats> {
    const items = await this.prisma.importItem.findMany({
      where: { jobId },
      select: {
        status: true, format: true, sizeBytes: true, importedAt: true, createdAt: true,
        classification: true,
      },
    });
    const byDepartment: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const byFormat: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let storageBytes = 0;
    const durations: number[] = [];

    for (const it of items) {
      byFormat[it.format] = (byFormat[it.format] ?? 0) + 1;
      byStatus[it.status] = (byStatus[it.status] ?? 0) + 1;
      if (it.importedAt) {
        storageBytes += it.sizeBytes;
        durations.push(it.importedAt.getTime() - it.createdAt.getTime());
      }
      const cls = (it.classification ?? {}) as { departmentCode?: string; categoryCode?: string };
      if (cls.departmentCode) byDepartment[cls.departmentCode] = (byDepartment[cls.departmentCode] ?? 0) + 1;
      if (cls.categoryCode) byCategory[cls.categoryCode] = (byCategory[cls.categoryCode] ?? 0) + 1;
    }

    const averageProcessingMs = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;
    return { byDepartment, byCategory, byFormat, byStatus, averageProcessingMs, storageBytes };
  }

  /** Cross-job dashboard metrics, department-scoped for non-global viewers. */
  async dashboard(scope: DataScope | undefined): Promise<ImportDashboardStatsDto> {
    // Items are scoped by the department encoded in their classification JSON.
    const items = await this.prisma.importItem.findMany({
      where: scope && !scope.isGlobal && scope.departmentId ? { classification: { path: ['departmentId'], equals: scope.departmentId } } : undefined,
      select: { status: true, format: true, sizeBytes: true, importedAt: true, createdAt: true, classification: true, jobId: true },
    });
    const jobIds = [...new Set(items.map((i) => i.jobId))];
    const jobs = jobIds.length
      ? await this.prisma.importJob.findMany({ where: { id: { in: jobIds } }, select: { status: true, warnings: true } })
      : [];

    const byDepartment: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const byFormat: Record<string, number> = {};
    let importedFiles = 0;
    let pendingReview = 0;
    let duplicates = 0;
    let storageBytes = 0;
    const warnings = jobs.reduce((sum, j) => sum + (j.warnings ?? 0), 0);
    const durations: number[] = [];

    for (const it of items) {
      byFormat[it.format] = (byFormat[it.format] ?? 0) + 1;
      if (it.status === 'IMPORTED') {
        importedFiles++;
        storageBytes += it.sizeBytes;
      }
      if (it.status === 'AWAITING_REVIEW') pendingReview++;
      if (it.status === 'DUPLICATE') duplicates++;
      if (it.importedAt) durations.push(it.importedAt.getTime() - it.createdAt.getTime());
      const cls = (it.classification ?? {}) as { departmentCode?: string; categoryCode?: string };
      if (cls.departmentCode) byDepartment[cls.departmentCode] = (byDepartment[cls.departmentCode] ?? 0) + 1;
      if (cls.categoryCode) byCategory[cls.categoryCode] = (byCategory[cls.categoryCode] ?? 0) + 1;
    }

    const countStatus = (s: string) => jobs.filter((j) => j.status === s).length;
    return {
      runningJobs: jobs.filter((j) => !['COMPLETED', 'FAILED', 'CANCELLED'].includes(j.status)).length,
      completedJobs: countStatus('COMPLETED'),
      failedJobs: countStatus('FAILED'),
      importedFiles,
      pendingReview,
      duplicates,
      warnings,
      errors: items.filter((i) => i.status === 'FAILED').length,
      averageProcessingMs: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null,
      byDepartment,
      byCategory,
      byFormat,
      storageBytes,
    };
  }

  /** Scope predicate helper for job listing (non-global viewers see their own jobs). */
  jobWhere(scope: DataScope | undefined, actorId: string): Record<string, unknown> {
    if (!scope || scope.isGlobal || !scope.departmentId) return {};
    return { OR: [{ startedById: actorId }, { items: { some: { classification: { path: ['departmentId'], equals: scope.departmentId } } } }] };
  }
}

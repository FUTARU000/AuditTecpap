import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DOCUMENT_EXPIRING_WINDOW_DAYS } from '@tecpap/config';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from './notification.service';

/**
 * Scans the QMS on a schedule and raises deadline/threshold notifications:
 * audits starting soon / overdue, CAPAs due / overdue, document (certificate)
 * expirations, document reviews overdue, KPI threshold breaches, and imports
 * awaiting review. Per-event dedup lives in NotificationService.emit, so a safe
 * manual re-run never spams the same user twice in the dedup window.
 */
@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  /** Daily at 06:00 — and callable manually for verification. */
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async scheduledRun(): Promise<void> {
    await this.runAll();
  }

  async runAll(): Promise<{ emitted: number }> {
    const emitted = (await Promise.all([
      this.auditReminders(),
      this.capaReminders(),
      this.documentReminders(),
      this.kpiReminders(),
      this.importReminders(),
    ])).reduce((a, b) => a + b, 0);
    this.logger.log(`Reminder scan emitted ${emitted} notification(s).`);
    return { emitted };
  }

  private async auditReminders(): Promise<number> {
    const now = new Date();
    const soon = new Date(now.getTime() + 24 * 3600_000);
    let count = 0;
    const upcoming = await this.prisma.audit.findMany({
      where: { status: 'PLANNED', scheduledDate: { gte: now, lte: soon } },
      select: { id: true, title: true, scheduledDate: true, auditorId: true, createdById: true },
    });
    for (const a of upcoming) {
      count += await this.tryEmit(a.auditorId ?? a.createdById, 'AUDIT_STARTING_SOON', 'audit', 'WARNING',
        `Audit starting soon: ${a.title}`, `Scheduled ${a.scheduledDate?.toISOString().slice(0, 10) ?? 'soon'}.`, 'audit', a.id, `/audits/${a.id}`);
    }
    const overdue = await this.prisma.audit.findMany({
      where: { status: { in: ['PLANNED', 'IN_PROGRESS'] }, scheduledDate: { lt: now } },
      select: { id: true, title: true, auditorId: true, createdById: true },
    });
    for (const a of overdue) {
      count += await this.tryEmit(a.auditorId ?? a.createdById, 'AUDIT_OVERDUE', 'audit', 'CRITICAL',
        `Audit overdue: ${a.title}`, 'This audit was scheduled in the past and is not complete.', 'audit', a.id, `/audits/${a.id}`);
    }
    return count;
  }

  private async capaReminders(): Promise<number> {
    const now = new Date();
    const dueSoon = new Date(now.getTime() + 3 * 24 * 3600_000);
    let count = 0;
    const due = await this.prisma.capa.findMany({
      where: { status: { notIn: ['CLOSED', 'CANCELLED'] }, deletedAt: null, targetDate: { gte: now, lte: dueSoon } },
      select: { id: true, title: true, referenceNumber: true, targetDate: true, ownerId: true, createdById: true },
    });
    for (const c of due) {
      count += await this.tryEmit(c.ownerId ?? c.createdById, 'CAPA_DUE', 'capa', 'WARNING',
        `CAPA due soon: ${c.referenceNumber}`, `${c.title} is due ${c.targetDate?.toISOString().slice(0, 10) ?? 'soon'}.`, 'capa', c.id, `/capas/${c.id}`);
    }
    const overdue = await this.prisma.capa.findMany({
      where: { status: { notIn: ['CLOSED', 'CANCELLED'] }, deletedAt: null, targetDate: { lt: now } },
      select: { id: true, title: true, referenceNumber: true, ownerId: true, createdById: true },
    });
    for (const c of overdue) {
      count += await this.tryEmit(c.ownerId ?? c.createdById, 'CAPA_OVERDUE', 'capa', 'CRITICAL',
        `CAPA overdue: ${c.referenceNumber}`, `${c.title} is past its target date.`, 'capa', c.id, `/capas/${c.id}`);
    }
    return count;
  }

  private async documentReminders(): Promise<number> {
    const now = new Date();
    const expiring = new Date(now.getTime() + DOCUMENT_EXPIRING_WINDOW_DAYS * 24 * 3600_000);
    let count = 0;
    const docs = await this.prisma.controlledDocument.findMany({
      where: { deletedAt: null, expirationDate: { gte: now, lte: expiring } },
      select: { id: true, title: true, code: true, expirationDate: true, ownerId: true, createdById: true, approverId: true },
    });
    for (const d of docs) {
      count += await this.tryEmit(d.ownerId ?? d.approverId ?? d.createdById, 'CERTIFICATE_EXPIRING', 'document', 'WARNING',
        `Document expiring: ${d.code}`, `${d.title} expires ${d.expirationDate?.toISOString().slice(0, 10) ?? 'soon'}.`, 'document', d.id, `/documents/${d.id}`);
    }
    const reviewOverdue = await this.prisma.controlledDocument.findMany({
      where: { deletedAt: null, status: 'PUBLISHED', reviewDate: { lt: now } },
      select: { id: true, title: true, code: true, ownerId: true, reviewerId: true, createdById: true },
    });
    for (const d of reviewOverdue) {
      count += await this.tryEmit(d.reviewerId ?? d.ownerId ?? d.createdById, 'DOCUMENT_REVIEW_OVERDUE', 'document', 'WARNING',
        `Review overdue: ${d.code}`, `${d.title} is past its review date and needs re-review.`, 'document', d.id, `/documents/${d.id}`);
    }
    return count;
  }

  private async kpiReminders(): Promise<number> {
    let count = 0;
    // Heuristic: a KPI whose current value has crossed its critical threshold (lower-is-worse convention).
    const kpis = await this.prisma.kpi.findMany({
      where: { status: 'ACTIVE', currentValue: { not: null }, criticalThreshold: { not: null } },
      select: { id: true, name: true, currentValue: true, criticalThreshold: true, unit: true, responsibleUserId: true, departmentId: true },
    });
    for (const k of kpis) {
      if (k.currentValue !== null && k.criticalThreshold !== null && k.currentValue <= k.criticalThreshold) {
        count += await this.tryEmit(k.responsibleUserId, 'KPI_THRESHOLD_EXCEEDED', 'kpi', 'CRITICAL',
          `KPI threshold breached: ${k.name}`, `Current ${k.currentValue}${k.unit ?? ''} crossed the critical threshold (${k.criticalThreshold}).`, 'kpi', k.id, `/kpis`, k.departmentId ?? undefined);
      }
    }
    return count;
  }

  private async importReminders(): Promise<number> {
    let count = 0;
    const jobs = await this.prisma.importJob.findMany({
      where: { status: 'WAITING_REVIEW' },
      select: { id: true, name: true, startedById: true },
    });
    for (const j of jobs) {
      count += await this.tryEmit(j.startedById, 'IMPORT_REQUIRES_REVIEW', 'import', 'INFO',
        `Import awaiting review: ${j.name ?? j.id.slice(0, 8)}`, 'Imported files are waiting for review and approval.', 'import_job', j.id, `/import/${j.id}`);
    }
    return count;
  }

  private async tryEmit(
    userId: string | null | undefined, type: Parameters<NotificationService['emit']>[0]['type'], category: string,
    severity: 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL', title: string, message: string, entityType: string, entityId: string, actionUrl: string, departmentId?: string,
  ): Promise<number> {
    if (!userId) return 0;
    const created = await this.notifications.emit({ userId, type, category, severity, title, message, entityType, entityId, actionUrl, departmentId });
    return created ? 1 : 0;
  }
}

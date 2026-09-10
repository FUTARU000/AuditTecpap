import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DOCUMENT_EXPIRING_WINDOW_DAYS, type NotificationTemplateParams } from '@tecpap/config';
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
        { title: a.title, scheduledDate: a.scheduledDate?.toISOString().slice(0, 10) ?? 'soon' }, 'audit', a.id, `/audits/${a.id}`);
    }
    const overdue = await this.prisma.audit.findMany({
      where: { status: { in: ['PLANNED', 'IN_PROGRESS'] }, scheduledDate: { lt: now } },
      select: { id: true, title: true, auditorId: true, createdById: true },
    });
    for (const a of overdue) {
      count += await this.tryEmit(a.auditorId ?? a.createdById, 'AUDIT_OVERDUE', 'audit', 'CRITICAL',
        { title: a.title }, 'audit', a.id, `/audits/${a.id}`);
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
        { reference: c.referenceNumber, title: c.title, dueDate: c.targetDate?.toISOString().slice(0, 10) ?? 'soon' }, 'capa', c.id, `/capas/${c.id}`);
    }
    const overdue = await this.prisma.capa.findMany({
      where: { status: { notIn: ['CLOSED', 'CANCELLED'] }, deletedAt: null, targetDate: { lt: now } },
      select: { id: true, title: true, referenceNumber: true, ownerId: true, createdById: true },
    });
    for (const c of overdue) {
      count += await this.tryEmit(c.ownerId ?? c.createdById, 'CAPA_OVERDUE', 'capa', 'CRITICAL',
        { reference: c.referenceNumber, title: c.title }, 'capa', c.id, `/capas/${c.id}`);
    }
    return count;
  }

  private async documentReminders(): Promise<number> {
    const now = new Date();
    const DAY_MS = 24 * 3600_000;
    let count = 0;

    const getDeptCat = async (departmentId: string, categoryId: string) => {
      const [dept, cat] = await Promise.all([
        this.prisma.department.findUnique({ where: { id: departmentId }, select: { name: true } }).catch(() => null),
        this.prisma.documentCategory.findUnique({ where: { id: categoryId }, select: { name: true } }).catch(() => null),
      ]);
      return { deptName: dept?.name ?? '', catName: cat?.name ?? '' };
    };

    // TECPAP rule: notify Audit Managers + department Pilots at 90/30/7 days and on expiration.
    const thresholds = [90, 30, 7] as const;
    for (const days of thresholds) {
      const windowStart = new Date(now.getTime() + (days - 1) * DAY_MS);
      const windowEnd = new Date(now.getTime() + days * DAY_MS);
      const docs = await this.prisma.controlledDocument.findMany({
        where: { deletedAt: null, status: { in: ['APPROVED', 'PUBLISHED'] }, expirationDate: { gte: windowStart, lt: windowEnd } },
        select: { id: true, title: true, code: true, expirationDate: true, departmentId: true, categoryId: true },
      });
      for (const d of docs) {
        const { deptName, catName } = await getDeptCat(d.departmentId, d.categoryId);
        const params = { code: d.code, title: d.title, deptName, catName, expirationDate: d.expirationDate?.toISOString().slice(0, 10) ?? '', days };
        await this.notifyManagers('CERTIFICATE_EXPIRING', 'WARNING', params, 'document', d.id, `/documents/${d.id}`);
        await this.notifyDeptPilots(d.departmentId, 'CERTIFICATE_EXPIRING', 'WARNING', params, 'document', d.id, `/documents/${d.id}`);
        count++;
      }
    }

    // Already expired
    const expired = await this.prisma.controlledDocument.findMany({
      where: { deletedAt: null, status: { in: ['APPROVED', 'PUBLISHED'] }, expirationDate: { lt: now } },
      select: { id: true, title: true, code: true, expirationDate: true, departmentId: true, categoryId: true },
    });
    for (const d of expired) {
      const { deptName, catName } = await getDeptCat(d.departmentId, d.categoryId);
      const params = { code: d.code, title: d.title, deptName, catName, expirationDate: d.expirationDate?.toISOString().slice(0, 10) ?? '', expired: true };
      await this.notifyManagers('CERTIFICATE_EXPIRING', 'CRITICAL', params, 'document', d.id, `/documents/${d.id}`);
      await this.notifyDeptPilots(d.departmentId, 'CERTIFICATE_EXPIRING', 'CRITICAL', params, 'document', d.id, `/documents/${d.id}`);
      count++;
    }

    const reviewOverdue = await this.prisma.controlledDocument.findMany({
      where: { deletedAt: null, status: 'PUBLISHED', reviewDate: { lt: now } },
      select: { id: true, title: true, code: true, ownerId: true, reviewerId: true, createdById: true },
    });
    for (const d of reviewOverdue) {
      count += await this.tryEmit(d.reviewerId ?? d.ownerId ?? d.createdById, 'DOCUMENT_REVIEW_OVERDUE', 'document', 'WARNING',
        { code: d.code, title: d.title }, 'document', d.id, `/documents/${d.id}`);
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
          { name: k.name, currentValue: k.currentValue, unit: k.unit ?? '', criticalThreshold: k.criticalThreshold }, 'kpi', k.id, `/kpis`, k.departmentId ?? undefined);
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
        { name: j.name ?? j.id.slice(0, 8) }, 'import_job', j.id, `/import/${j.id}`);
    }
    return count;
  }

  private async tryEmit(
    userId: string | null | undefined, type: Parameters<NotificationService['emit']>[0]['type'], category: string,
    severity: 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL', params: NotificationTemplateParams, entityType: string, entityId: string, actionUrl: string, departmentId?: string,
  ): Promise<number> {
    if (!userId) return 0;
    const created = await this.notifications.emit({ userId, type, category, severity, params, entityType, entityId, actionUrl, departmentId });
    return created ? 1 : 0;
  }

  /** Notify ALL global-role users (Audit Managers) — used for document expiration. */
  private async notifyManagers(
    type: Parameters<NotificationService['emit']>[0]['type'], severity: 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL',
    params: NotificationTemplateParams, entityType: string, entityId: string, actionUrl: string,
  ): Promise<void> {
    const managers = (await this.prisma.user.findMany({
      where: { role: { isGlobal: true }, status: 'ACTIVE', deletedAt: null },
      select: { id: true },
    })) ?? [];
    for (const m of managers) {
      await this.notifications.emit({ userId: m.id, type, category: entityType, severity, params, entityType, entityId, actionUrl }).catch(() => undefined);
    }
  }

  /** Notify Pilots belonging to a department — only if the document is theirs. */
  private async notifyDeptPilots(
    departmentId: string, type: Parameters<NotificationService['emit']>[0]['type'], severity: 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL',
    params: NotificationTemplateParams, entityType: string, entityId: string, actionUrl: string,
  ): Promise<void> {
    const pilots = (await this.prisma.user.findMany({
      where: { departmentId, role: { isGlobal: false }, status: 'ACTIVE', deletedAt: null },
      select: { id: true },
    })) ?? [];
    for (const p of pilots) {
      await this.notifications.emit({ userId: p.id, type, category: entityType, severity, params, entityType, entityId, actionUrl, departmentId }).catch(() => undefined);
    }
  }
}

import { Injectable } from '@nestjs/common';
import type { WorkspaceDto } from '@tecpap/types';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from './notification.service';

/** Personalized dashboard: the signed-in user's work, deadlines and counts. */
@Injectable()
export class WorkspaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  async get(userId: string): Promise<WorkspaceDto> {
    const take = 6;
    const [user, audits, capas, findings, docs, imports, kpis, openTasks] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { department: { select: { name: true } } } }),
      this.prisma.audit.findMany({ where: { OR: [{ auditorId: userId }, { createdById: userId }], status: { not: 'COMPLETED' } }, take, orderBy: { scheduledDate: 'asc' }, select: { id: true, title: true, status: true, scheduledDate: true } }),
      this.prisma.capa.findMany({ where: { OR: [{ ownerId: userId }, { createdById: userId }], status: { notIn: ['CLOSED', 'CANCELLED'] }, deletedAt: null }, take, orderBy: { targetDate: 'asc' }, select: { id: true, title: true, status: true, targetDate: true, priority: true } }),
      this.prisma.finding.findMany({ where: { responsibleUserId: userId, status: 'OPEN' }, take, orderBy: { createdAt: 'desc' }, select: { id: true, title: true, severity: true, status: true } }),
      this.prisma.controlledDocument.findMany({ where: { OR: [{ ownerId: userId }, { reviewerId: userId }, { approverId: userId }], status: { in: ['UNDER_REVIEW', 'APPROVED', 'DRAFT'] }, deletedAt: null }, take, orderBy: { updatedAt: 'desc' }, select: { id: true, title: true, code: true, status: true } }),
      this.prisma.importJob.findMany({ where: { startedById: userId, status: { notIn: ['COMPLETED', 'CANCELLED', 'FAILED'] } }, take, orderBy: { createdAt: 'desc' }, select: { id: true, name: true, status: true, items: { where: { status: 'AWAITING_REVIEW' }, select: { id: true } } } }),
      this.prisma.kpi.findMany({ where: { responsibleUserId: userId, status: 'ACTIVE' }, take, orderBy: { name: 'asc' }, select: { id: true, name: true, currentValue: true, target: true, unit: true } }),
      this.countOpenTasks(userId),
    ]);

    const deadlines: { title: string; date: string; type: string; href: string }[] = [];
    for (const a of audits) if (a.scheduledDate) deadlines.push({ title: `Audit: ${a.title}`, date: a.scheduledDate.toISOString(), type: 'audit', href: `/audits/${a.id}` });
    for (const c of capas) if (c.targetDate) deadlines.push({ title: `CAPA: ${c.title}`, date: c.targetDate.toISOString(), type: 'capa', href: `/capas/${c.id}` });
    const horizon = Date.now() + 30 * 24 * 3600_000;
    const upcoming = deadlines.filter((d) => new Date(d.date).getTime() <= horizon).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8);

    return {
      audits: audits.map((a) => ({ id: a.id, title: a.title, status: a.status, scheduledDate: a.scheduledDate?.toISOString() ?? null, href: `/audits/${a.id}` })),
      capas: capas.map((c) => ({ id: c.id, title: c.title, status: c.status, targetDate: c.targetDate?.toISOString() ?? null, priority: c.priority, href: `/capas/${c.id}` })),
      findings: findings.map((f) => ({ id: f.id, title: f.title, severity: f.severity, status: f.status, href: `/audits` })),
      pendingApprovals: docs.map((d) => ({ id: d.id, title: d.title, code: d.code, status: d.status, type: 'document', href: `/documents/${d.id}` })),
      imports: imports.map((i) => ({ id: i.id, name: i.name ?? i.id.slice(0, 8), status: i.status, pending: i.items.length, href: `/import/${i.id}` })),
      kpis: kpis.map((k) => ({ id: k.id, name: k.name, currentValue: k.currentValue, target: k.target, unit: k.unit, href: `/kpis` })),
      upcomingDeadlines: upcoming,
      unreadNotifications: await this.notifications.unreadCount(userId),
      openTasks,
      departmentName: user?.department?.name ?? null,
    };
  }

  private async countOpenTasks(userId: string): Promise<number> {
    const [audits, capas, findings, docs, imports, risks] = await Promise.all([
      this.prisma.audit.count({ where: { OR: [{ auditorId: userId }, { createdById: userId }], status: { not: 'COMPLETED' } } }),
      this.prisma.capa.count({ where: { OR: [{ ownerId: userId }, { createdById: userId }], status: { notIn: ['CLOSED', 'CANCELLED'] }, deletedAt: null } }),
      this.prisma.finding.count({ where: { responsibleUserId: userId, status: 'OPEN' } }),
      this.prisma.controlledDocument.count({ where: { OR: [{ ownerId: userId }, { reviewerId: userId }, { approverId: userId }], status: { in: ['UNDER_REVIEW', 'APPROVED', 'DRAFT'] }, deletedAt: null } }),
      this.prisma.importJob.count({ where: { startedById: userId, status: 'WAITING_REVIEW' } }),
      this.prisma.processRisk.count({ where: { ownerId: userId, status: 'OPEN', reviewDate: { lt: new Date() } } }),
    ]);
    return audits + capas + findings + docs + imports + risks;
  }
}

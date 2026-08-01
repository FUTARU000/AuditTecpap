import { Injectable, NotFoundException } from '@nestjs/common';
import type { UserTaskDto } from '@tecpap/types';
import { PrismaService } from '../prisma/prisma.service';

interface RawTask {
  source: string;
  entityType: string;
  entityId: string;
  title: string;
  dueDate: Date | null;
  href: string;
}

/**
 * Personal task center — auto-generated from the user's assignments and pending
 * approvals. The live view is always current; completion/dismissal are stored as
 * overrides on UserTask so a task stays "done" once marked.
 */
@Injectable()
export class TaskService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<UserTaskDto[]> {
    const [audits, capas, findings, docs, imports, risks, overrides] = await Promise.all([
      this.prisma.audit.findMany({ where: { OR: [{ auditorId: userId }, { createdById: userId }], status: { not: 'COMPLETED' } }, select: { id: true, title: true, scheduledDate: true, status: true } }),
      this.prisma.capa.findMany({ where: { OR: [{ ownerId: userId }, { createdById: userId }], status: { notIn: ['CLOSED', 'CANCELLED'] }, deletedAt: null }, select: { id: true, title: true, referenceNumber: true, targetDate: true, priority: true } }),
      this.prisma.finding.findMany({ where: { responsibleUserId: userId, status: 'OPEN' }, select: { id: true, title: true, severity: true, dueDate: true } }),
      this.prisma.controlledDocument.findMany({ where: { OR: [{ ownerId: userId }, { reviewerId: userId }, { approverId: userId }], status: { in: ['UNDER_REVIEW', 'APPROVED', 'DRAFT'] }, deletedAt: null }, select: { id: true, title: true, code: true, status: true } }),
      this.prisma.importJob.findMany({ where: { startedById: userId, status: 'WAITING_REVIEW' }, select: { id: true, name: true } }),
      this.prisma.processRisk.findMany({ where: { ownerId: userId, status: 'OPEN', reviewDate: { lt: new Date() } }, select: { id: true, title: true, reviewDate: true } }),
      this.prisma.userTask.findMany({ where: { userId }, select: { entityType: true, entityId: true, completedAt: true, dismissedAt: true, createdAt: true } }),
    ]);

    const now = Date.now();
    const raw: RawTask[] = [
      ...audits.map((a): RawTask => ({ source: 'audit', entityType: 'audit', entityId: a.id, title: `Audit: ${a.title}`, dueDate: a.scheduledDate, href: `/audits/${a.id}` })),
      ...capas.map((c): RawTask => ({ source: 'capa', entityType: 'capa', entityId: c.id, title: `CAPA ${c.referenceNumber}: ${c.title}`, dueDate: c.targetDate, href: `/capas/${c.id}` })),
      ...findings.map((f): RawTask => ({ source: 'finding', entityType: 'finding', entityId: f.id, title: `Finding: ${f.title}`, dueDate: f.dueDate, href: `/audits` })),
      ...docs.map((d): RawTask => ({ source: 'document', entityType: 'document', entityId: d.id, title: `Approval: ${d.code} — ${d.title}`, dueDate: null, href: `/documents/${d.id}` })),
      ...imports.map((i): RawTask => ({ source: 'import', entityType: 'import_job', entityId: i.id, title: `Import review: ${i.name ?? i.id.slice(0, 8)}`, dueDate: null, href: `/import/${i.id}` })),
      ...risks.map((r): RawTask => ({ source: 'risk', entityType: 'risk', entityId: r.id, title: `Risk review: ${r.title}`, dueDate: r.reviewDate, href: `/risks` })),
    ];

    const overrideMap = new Map(overrides.map((o) => [`${o.entityType}:${o.entityId}`, o]));
    const tasks: UserTaskDto[] = [];
    for (const t of raw) {
      const ov = overrideMap.get(`${t.entityType}:${t.entityId}`);
      if (ov?.dismissedAt) continue;
      const overdue = !!t.dueDate && t.dueDate.getTime() < now;
      tasks.push({
        id: ov?.createdAt ? `${t.entityType}:${t.entityId}` : `${t.entityType}:${t.entityId}`,
        source: t.source, entityType: t.entityType, entityId: t.entityId, title: t.title,
        priority: overdue ? 'HIGH' : 'MEDIUM',
        dueDate: t.dueDate?.toISOString() ?? null, href: t.href,
        completed: !!ov?.completedAt, dismissed: false,
        createdAt: (ov?.createdAt ?? new Date(0)).toISOString(),
      });
    }
    const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return tasks.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (order[a.priority] !== order[b.priority]) return order[a.priority] - order[b.priority];
      return (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999');
    });
  }

  async setComplete(userId: string, entityType: string, entityId: string, completed: boolean): Promise<void> {
    const existing = await this.prisma.userTask.findUnique({ where: { userId_entityType_entityId: { userId, entityType, entityId } } });
    if (!existing && !completed) throw new NotFoundException('Task not found');
    await this.prisma.userTask.upsert({
      where: { userId_entityType_entityId: { userId, entityType, entityId } },
      update: { completedAt: completed ? new Date() : null },
      create: { userId, entityType, entityId, source: entityType, title: entityId, completedAt: completed ? new Date() : null },
    });
  }

  async dismiss(userId: string, entityType: string, entityId: string): Promise<void> {
    await this.prisma.userTask.upsert({
      where: { userId_entityType_entityId: { userId, entityType, entityId } },
      update: { dismissedAt: new Date() },
      create: { userId, entityType, entityId, source: entityType, title: entityId, dismissedAt: new Date() },
    });
  }
}

import { Injectable } from '@nestjs/common';
import type { CalendarEventDto } from '@tecpap/types';
import type { Prisma } from '@prisma/client';
import { departmentScopeWhere } from '../../common/scoping/scope';
import type { DataScope } from '../../common/types/data-scope';
import { PrismaService } from '../prisma/prisma.service';

/** Operational calendar — aggregates every dated QMS event into one feed. */
@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  async events(scope: DataScope | undefined, from: Date, to: Date): Promise<CalendarEventDto[]> {
    const scoped = !!scope && !scope.isGlobal;
    const departmentId = scope?.departmentId ?? undefined;
    const docWhere = departmentScopeWhere(scope, { deletedAt: null }) as Prisma.ControlledDocumentWhereInput;
    const capaWhere = departmentScopeWhere(scope, { deletedAt: null }) as Prisma.CapaWhereInput;

    const [audits, capas, docs, findings, risks] = await Promise.all([
      this.prisma.audit.findMany({ where: { scheduledDate: { gte: from, lte: to }, ...(scoped ? { departmentId } : {}) }, select: { id: true, title: true, scheduledDate: true, status: true } }),
      this.prisma.capa.findMany({ where: { ...capaWhere, targetDate: { gte: from, lte: to } }, select: { id: true, title: true, targetDate: true, status: true, priority: true } }),
      this.prisma.controlledDocument.findMany({ where: { ...docWhere, OR: [{ expirationDate: { gte: from, lte: to } }, { reviewDate: { gte: from, lte: to } }] }, select: { id: true, title: true, code: true, expirationDate: true, reviewDate: true, status: true } }),
      this.prisma.finding.findMany({ where: { dueDate: { gte: from, lte: to }, ...(scoped ? { audit: { departmentId } } : {}) }, select: { id: true, title: true, dueDate: true, severity: true, status: true } }),
      this.prisma.processRisk.findMany({ where: { reviewDate: { gte: from, lte: to }, ...(scoped ? { process: { departmentId } } : {}) }, select: { id: true, title: true, reviewDate: true, status: true } }),
    ]);

    const events: CalendarEventDto[] = [];
    for (const a of audits) events.push(this.ev(`Audit: ${a.title}`, a.scheduledDate!, 'audit', a.id, `/audits/${a.id}`, a.status, null));
    for (const c of capas) events.push(this.ev(`CAPA: ${c.title}`, c.targetDate!, 'capa', c.id, `/capas/${c.id}`, c.status, c.priority));
    for (const d of docs) {
      if (d.expirationDate) events.push(this.ev(`Expires: ${d.code}`, d.expirationDate, 'document', d.id, `/documents/${d.id}`, d.status, null));
      if (d.reviewDate) events.push(this.ev(`Review: ${d.code}`, d.reviewDate, 'document', d.id, `/documents/${d.id}`, d.status, null));
    }
    for (const f of findings) events.push(this.ev(`Finding due: ${f.title}`, f.dueDate!, 'finding', f.id, `/audits`, f.status, f.severity));
    for (const r of risks) events.push(this.ev(`Risk review: ${r.title}`, r.reviewDate!, 'risk', r.id, `/risks`, r.status, null));
    return events.sort((a, b) => a.date.localeCompare(b.date));
  }

  private ev(title: string, date: Date, type: CalendarEventDto['type'], entityId: string, href: string, status: string | null, priority: string | null): CalendarEventDto {
    return { id: `${type}:${entityId}`, title, date: date.toISOString(), endDate: null, type, entityType: type, entityId, href, status, priority };
  }
}

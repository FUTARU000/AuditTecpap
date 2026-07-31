import { Injectable } from '@nestjs/common';
import { DOCUMENT_EXPIRING_WINDOW_DAYS } from '@tecpap/config';
import type { AuditDashboardStats, DashboardStatsDto, DocumentStatus, FindingSeverity } from '@tecpap/types';
import type { Prisma } from '@prisma/client';
import { departmentScopeWhere } from '../../common/scoping/scope';
import type { DataScope } from '../../common/types/data-scope';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async stats(scope: DataScope | undefined): Promise<DashboardStatsDto> {
    const docWhere = departmentScopeWhere(scope, { deletedAt: null }) as Prisma.ControlledDocumentWhereInput;
    const scoped = !!scope && !scope.isGlobal;
    const departmentId = scope?.departmentId ?? undefined;
    const auditWhere: Prisma.AuditWhereInput = scoped ? { departmentId } : {};
    const findingWhere: Prisma.FindingWhereInput = scoped ? { audit: { departmentId } } : {};
    const windowMs = DOCUMENT_EXPIRING_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const now = new Date();
    const soon = new Date(now.getTime() + windowMs);

    const [
      departments, processes, documents, byStatusRaw, drafts, published, expiring, awaiting, recent, awaitingDocs,
      scheduledAudits, inProgressAudits, completedAudits, overdueAudits, totalAudits, openFindings, findingsBySeverityRaw, complianceAvg, openCapas, overdueCapas, capaPendingVerif, capaPendingEff, capaClosed,
    ] = await Promise.all([
      this.prisma.department.count({ where: scoped ? { id: departmentId } : {} }),
      this.prisma.process.count({ where: { deletedAt: null, ...departmentScopeWhere(scope) } }),
      this.prisma.controlledDocument.count({ where: docWhere }),
      this.prisma.controlledDocument.groupBy({ by: ['status'], where: docWhere, _count: { _all: true } }),
      this.prisma.controlledDocument.count({ where: { ...docWhere, status: 'DRAFT' } }),
      this.prisma.controlledDocument.count({ where: { ...docWhere, status: 'PUBLISHED' } }),
      this.prisma.controlledDocument.count({ where: { ...docWhere, expirationDate: { lte: soon } } }),
      this.prisma.controlledDocument.count({ where: { ...docWhere, status: 'UNDER_REVIEW' } }),
      this.auditLog.list({ pageSize: '5' }),
      this.prisma.controlledDocument.findMany({
        where: { ...docWhere, status: 'UNDER_REVIEW' },
        take: 5,
        orderBy: { updatedAt: 'desc' },
        include: { department: { select: { name: true } } },
      }),
      // Audit widgets
      this.prisma.audit.count({ where: { ...auditWhere, status: 'PLANNED' } }),
      this.prisma.audit.count({ where: { ...auditWhere, status: 'IN_PROGRESS' } }),
      this.prisma.audit.count({ where: { ...auditWhere, status: 'COMPLETED' } }),
      this.prisma.audit.count({ where: { ...auditWhere, status: { in: ['PLANNED', 'IN_PROGRESS'] }, scheduledDate: { lt: now } } }),
      this.prisma.audit.count({ where: auditWhere }),
      this.prisma.finding.count({ where: { ...findingWhere, status: 'OPEN' } }),
      this.prisma.finding.groupBy({ by: ['severity'], where: findingWhere, _count: { _all: true } }),
      this.prisma.audit.aggregate({ _avg: { compliance: true }, where: { ...auditWhere, compliance: { not: null } } }),
      // CAPA widgets
      this.prisma.capa.count({ where: { ...departmentScopeWhere(scope, { deletedAt: null }) as Prisma.CapaWhereInput, status: { notIn: ['CLOSED', 'CANCELLED'] } } }),
      this.prisma.capa.count({ where: { ...departmentScopeWhere(scope, { deletedAt: null }) as Prisma.CapaWhereInput, status: { notIn: ['CLOSED', 'CANCELLED'] }, targetDate: { lt: now } } }),
      this.prisma.capa.count({ where: { ...departmentScopeWhere(scope, { deletedAt: null }) as Prisma.CapaWhereInput, status: 'PENDING_VERIFICATION' } }),
      this.prisma.capa.count({ where: { ...departmentScopeWhere(scope, { deletedAt: null }) as Prisma.CapaWhereInput, status: 'PENDING_EFFECTIVENESS' } }),
      this.prisma.capa.count({ where: { ...departmentScopeWhere(scope, { deletedAt: null }) as Prisma.CapaWhereInput, status: 'CLOSED' } }),
    ]);

    const audits: AuditDashboardStats = {
      scheduled: scheduledAudits,
      inProgress: inProgressAudits,
      completed: completedAudits,
      overdue: overdueAudits,
      openFindings,
      findingsBySeverity: findingsBySeverityRaw.map((row) => ({ severity: row.severity as FindingSeverity, count: row._count._all })),
      complianceRate: complianceAvg._avg.compliance !== null ? Math.round(complianceAvg._avg.compliance ?? 0) : 0,
      completionRate: totalAudits > 0 ? Math.round((completedAudits / totalAudits) * 100) : 0,
    };

    return {
      departments,
      processes,
      documents,
      byStatus: byStatusRaw.map((row) => ({ status: row.status as DocumentStatus, count: row._count._all })),
      drafts,
      published,
      expiring,
      awaitingApproval: awaiting,
      recentUpdates: recent.items.map((entry) => ({
        id: entry.id,
        action: entry.action,
        target: entry.target,
        actorName: entry.actorName,
        createdAt: entry.createdAt,
      })),
      documentsAwaitingApproval: awaitingDocs.map((doc) => ({
        id: doc.id,
        title: doc.title,
        code: doc.code,
        status: doc.status as DocumentStatus,
        departmentName: doc.department?.name ?? null,
        updatedAt: doc.updatedAt.toISOString(),
      })),
      audits,
      capas: { open: openCapas, overdue: overdueCapas, pendingVerification: capaPendingVerif, pendingEffectiveness: capaPendingEff, closed: capaClosed },
    };
  }
}

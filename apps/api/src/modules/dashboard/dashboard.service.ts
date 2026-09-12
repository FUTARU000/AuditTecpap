import { Injectable } from '@nestjs/common';
import { DOCUMENT_EXPIRING_WINDOW_DAYS } from '@tecpap/config';
import type {
  AuditDashboardStats,
  DashboardAttentionItemDto,
  DashboardStatsDto,
  DocumentStatus,
  FindingSeverity,
} from '@tecpap/types';
import type { Prisma } from '@prisma/client';
import { departmentScopeWhere } from '../../common/scoping/scope';
import type { DataScope } from '../../common/types/data-scope';
import { AuditLogService } from '../audit-log/audit-log.service';
import { evaluateIndicator } from '../indicators/indicator-evaluation.util';
import { PrismaService } from '../prisma/prisma.service';

/** Cap per "requires attention" category — actionable highlights, not an exhaustive list. */
const ATTENTION_LIMIT = 5;

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async stats(
    scope: DataScope | undefined,
    userId?: string,
    permissions?: string[],
  ): Promise<DashboardStatsDto> {
    const docWhere = departmentScopeWhere(scope, {
      deletedAt: null,
    }) as Prisma.ControlledDocumentWhereInput;
    const scoped = !!scope && !scope.isGlobal;
    const departmentId = scope?.departmentId ?? undefined;
    const isManager = permissions?.includes('capas.verify') ?? false;
    const isPilot = !isManager && (permissions?.includes('capas.submit') ?? false);
    const auditWhere: Prisma.AuditWhereInput = scoped ? { departmentId } : {};
    const findingWhere: Prisma.FindingWhereInput = scoped ? { audit: { departmentId } } : {};
    const capaWhere = departmentScopeWhere(scope, { deletedAt: null }) as Prisma.CapaWhereInput;
    const windowMs = DOCUMENT_EXPIRING_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const now = new Date();
    const soon = new Date(now.getTime() + windowMs);

    const [
      departments,
      documents,
      drafts,
      awaiting,
      expiring,
      recent,
      awaitingDocs,
      scheduledAudits,
      inProgressAudits,
      completedAudits,
      overdueAudits,
      totalAudits,
      openFindings,
      findingsBySeverityRaw,
      complianceAvg,
      openCapas,
      overdueCapas,
      capaPendingVerif,
      capaReturned,
      capaValidated,
      overdueAuditRows,
      overdueCapaRows,
      returnedCapaRows,
      upcomingAuditRows,
    ] = await Promise.all([
      this.prisma.department.count({ where: scoped ? { id: departmentId } : {} }),
      this.prisma.controlledDocument.count({ where: docWhere }),
      this.prisma.controlledDocument.count({ where: { ...docWhere, status: 'DRAFT' } }),
      this.prisma.controlledDocument.count({ where: { ...docWhere, status: 'UNDER_REVIEW' } }),
      this.prisma.controlledDocument.count({
        where: { ...docWhere, expirationDate: { lte: soon } },
      }),
      this.auditLog.list({ pageSize: '5' }),
      this.prisma.controlledDocument.findMany({
        where: { ...docWhere, status: 'UNDER_REVIEW' },
        take: ATTENTION_LIMIT,
        orderBy: { updatedAt: 'desc' },
        include: { department: { select: { name: true } } },
      }),
      // Audit programme
      this.prisma.audit.count({ where: { ...auditWhere, status: 'PLANNED' } }),
      this.prisma.audit.count({ where: { ...auditWhere, status: 'IN_PROGRESS' } }),
      this.prisma.audit.count({ where: { ...auditWhere, status: 'COMPLETED' } }),
      this.prisma.audit.count({
        where: {
          ...auditWhere,
          status: { in: ['PLANNED', 'IN_PROGRESS'] },
          scheduledDate: { lt: now },
        },
      }),
      this.prisma.audit.count({ where: auditWhere }),
      this.prisma.finding.count({ where: { ...findingWhere, status: 'OPEN' } }),
      this.prisma.finding.groupBy({
        by: ['severity'],
        where: findingWhere,
        _count: { _all: true },
      }),
      this.prisma.audit.aggregate({
        _avg: { compliance: true },
        where: { ...auditWhere, compliance: { not: null } },
      }),
      // CAPA
      this.prisma.capa.count({
        where: { ...capaWhere, status: { notIn: ['CLOSED', 'CANCELLED'] } },
      }),
      this.prisma.capa.count({
        where: {
          ...capaWhere,
          status: { notIn: ['CLOSED', 'CANCELLED'] },
          targetDate: { lt: now },
        },
      }),
      this.prisma.capa.count({ where: { ...capaWhere, status: 'PENDING_VERIFICATION' } }),
      this.prisma.capa.count({ where: { ...capaWhere, status: 'RETURNED' } }),
      this.prisma.capa.count({ where: { ...capaWhere, status: 'VALIDATED' } }),
      // Requires-attention detail rows
      this.prisma.audit.findMany({
        where: {
          ...auditWhere,
          status: { in: ['PLANNED', 'IN_PROGRESS'] },
          scheduledDate: { lt: now },
        },
        take: ATTENTION_LIMIT,
        orderBy: { scheduledDate: 'asc' },
        select: { id: true, title: true, scheduledDate: true },
      }),
      this.prisma.capa.findMany({
        where: {
          ...capaWhere,
          status: { notIn: ['CLOSED', 'CANCELLED'] },
          targetDate: { lt: now },
        },
        take: ATTENTION_LIMIT,
        orderBy: { targetDate: 'asc' },
        select: { id: true, referenceNumber: true, title: true, targetDate: true },
      }),
      this.prisma.capa.findMany({
        where: { ...capaWhere, status: 'RETURNED' },
        take: ATTENTION_LIMIT,
        orderBy: { updatedAt: 'desc' },
        select: { id: true, referenceNumber: true, title: true },
      }),
      this.prisma.audit.findMany({
        where: { ...auditWhere, status: 'PLANNED', scheduledDate: { gte: now } },
        take: ATTENTION_LIMIT,
        orderBy: { scheduledDate: 'asc' },
        include: { department: { select: { name: true } } },
      }),
    ]);

    const audits: AuditDashboardStats = {
      scheduled: scheduledAudits,
      inProgress: inProgressAudits,
      completed: completedAudits,
      overdue: overdueAudits,
      openFindings,
      findingsBySeverity: findingsBySeverityRaw.map((row) => ({
        severity: row.severity as FindingSeverity,
        count: row._count._all,
      })),
      complianceRate:
        complianceAvg._avg.compliance !== null ? Math.round(complianceAvg._avg.compliance ?? 0) : 0,
      completionRate: totalAudits > 0 ? Math.round((completedAudits / totalAudits) * 100) : 0,
    };

    const indicators = await this.indicatorsSummary(scope);

    const requiresAttention: DashboardAttentionItemDto[] = [
      ...indicators.criticalItems,
      ...overdueAuditRows.map((a): DashboardAttentionItemDto => ({
        type: 'OVERDUE_AUDIT',
        id: a.id,
        title: a.title,
        href: `/audits/${a.id}`,
        detail: a.scheduledDate ? new Date(a.scheduledDate).toLocaleDateString() : null,
      })),
      ...overdueCapaRows.map((c): DashboardAttentionItemDto => ({
        type: 'OVERDUE_CAPA',
        id: c.id,
        title: `${c.referenceNumber}: ${c.title}`,
        href: `/capas/${c.id}`,
        detail: c.targetDate ? new Date(c.targetDate).toLocaleDateString() : null,
      })),
      ...awaitingDocs.map((d): DashboardAttentionItemDto => ({
        type: 'DOCUMENT_AWAITING_APPROVAL',
        id: d.id,
        title: `${d.code}: ${d.title}`,
        href: `/documents/${d.id}`,
        detail: d.department?.name ?? null,
      })),
      ...returnedCapaRows.map((c): DashboardAttentionItemDto => ({
        type: 'RETURNED_CAPA',
        id: c.id,
        title: `${c.referenceNumber}: ${c.title}`,
        href: `/capas/${c.id}`,
        detail: null,
      })),
    ];

    return {
      overview: {
        departments,
        activeDocuments: documents,
        activeIndicators: indicators.active,
        openFindings,
        openCapas,
        auditsInProgress: inProgressAudits,
      },
      documents: {
        totalActive: documents,
        awaitingApproval: awaiting,
        drafts,
        expiringSoon: expiring,
      },
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
      upcomingAudits: upcomingAuditRows.map((a) => ({
        id: a.id,
        title: a.title,
        departmentName: a.department?.name ?? null,
        scheduledDate: a.scheduledDate?.toISOString() ?? null,
      })),
      audits,
      capas: {
        open: openCapas,
        awaitingVerification: capaPendingVerif,
        returned: capaReturned,
        validated: capaValidated,
        overdue: overdueCapas,
      },
      requiresAttention,
      // Phase 7.7 — TECPAP role-scoped workflow metrics
      ...(isManager ? await this.managerStats(scope) : {}),
      ...(isPilot && userId ? await this.pilotStats(scope, userId) : {}),
      indicators: {
        active: indicators.active,
        onTarget: indicators.onTarget,
        warning: indicators.warning,
        critical: indicators.critical,
        noData: indicators.noData,
      },
    };
  }

  /**
   * Full ON_TARGET/WARNING/CRITICAL/NO_DATA breakdown, reusing the exact same
   * evaluateIndicator() logic as the Indicators module itself (no separate
   * "dashboard version" of the evaluation rules). Also returns the critical
   * items themselves (capped) for the "requires attention" panel.
   */
  private async indicatorsSummary(scope: DataScope | undefined): Promise<{
    total: number;
    active: number;
    onTarget: number;
    warning: number;
    critical: number;
    noData: number;
    criticalItems: DashboardAttentionItemDto[];
  }> {
    const rows = await this.prisma.indicator.findMany({
      where: departmentScopeWhere(scope, { active: true }) as Prisma.IndicatorWhereInput,
      select: {
        id: true,
        name: true,
        unit: true,
        direction: true,
        target: true,
        warningThreshold: true,
        criticalThreshold: true,
        values: {
          orderBy: [
            { year: 'desc' as const },
            { periodMonth: 'desc' as const },
            { createdAt: 'desc' as const },
          ],
          take: 1,
          select: { value: true },
        },
      },
    });
    let onTarget = 0,
      warning = 0,
      critical = 0,
      noData = 0;
    const criticalItems: DashboardAttentionItemDto[] = [];
    for (const row of rows) {
      const value = row.values[0]?.value ?? null;
      const status = evaluateIndicator({
        direction: row.direction,
        value,
        target: row.target,
        warningThreshold: row.warningThreshold,
        criticalThreshold: row.criticalThreshold,
      });
      if (status === 'ON_TARGET') onTarget++;
      else if (status === 'WARNING') warning++;
      else if (status === 'CRITICAL') {
        critical++;
        if (criticalItems.length < ATTENTION_LIMIT) {
          criticalItems.push({
            type: 'CRITICAL_INDICATOR',
            id: row.id,
            title: row.name,
            href: `/indicators/${row.id}`,
            detail: value !== null ? `${value}${row.unit ? ` ${row.unit}` : ''}` : null,
          });
        }
      } else noData++;
    }
    return {
      total: rows.length,
      active: rows.length,
      onTarget,
      warning,
      critical,
      noData,
      criticalItems,
    };
  }

  /** Audit Manager workflow metrics: CAPAs awaiting their action. */
  private async managerStats(scope: DataScope | undefined): Promise<Partial<DashboardStatsDto>> {
    const capaWhere = departmentScopeWhere(scope, { deletedAt: null }) as Prisma.CapaWhereInput;
    const [capasToVerify, capasToValidate, capasReturned] = await Promise.all([
      this.prisma.capa.count({ where: { ...capaWhere, status: 'PENDING_VERIFICATION' } }),
      this.prisma.capa.count({ where: { ...capaWhere, status: 'VALIDATED' } }),
      this.prisma.capa.count({ where: { ...capaWhere, status: 'RETURNED' } }),
    ]);
    return { capasToVerify, capasToValidate, capasReturned };
  }

  /** Pilot workflow metrics: CAPAs requiring pilot action. */
  private async pilotStats(
    scope: DataScope | undefined,
    userId: string,
  ): Promise<Partial<DashboardStatsDto>> {
    const capaWhere = departmentScopeWhere(scope, {
      deletedAt: null,
      ownerId: userId,
    }) as Prisma.CapaWhereInput;
    const [myActionsPending, myReturnedCapas] = await Promise.all([
      this.prisma.capa.count({
        where: { ...capaWhere, status: { in: ['ASSIGNED', 'IN_PROGRESS', 'EVIDENCE_UPLOADED'] } },
      }),
      this.prisma.capa.count({ where: { ...capaWhere, status: 'RETURNED' } }),
    ]);
    return { myActionsPending, myReturnedCapas };
  }
}

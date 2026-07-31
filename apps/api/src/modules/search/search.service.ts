import { Injectable } from '@nestjs/common';
import { ENTITY_TYPE_LABELS, type EntityType } from '@tecpap/config';
import type { GroupedSearchResultDto, SearchGroup } from '@tecpap/types';
import type { DataScope } from '../../common/types/data-scope';
import { PrismaService } from '../prisma/prisma.service';

const LIMIT = 8;

/**
 * Global, grouped search across the operational entities. Results are
 * department-scoped for non-global principals. Document text matching here is
 * a broad ILIKE; ranked PostgreSQL FTS remains available at
 * `GET /documents/search` for the documents domain.
 */
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(term: string, scope: DataScope | undefined): Promise<GroupedSearchResultDto> {
    const q = term.trim();
    if (q.length < 2) {
      return { query: term, total: 0, groups: [] };
    }

    const scoped = !!scope && !scope.isGlobal;
    const departmentId = scope?.departmentId ?? undefined;
    const contains = { contains: q, mode: 'insensitive' as const };

    const [processes, documents, objects, kpis, risks, templates, audits, findings, capas] = await Promise.all([
      this.prisma.process.findMany({
        where: { deletedAt: null, ...(scoped ? { departmentId } : {}), OR: [{ name: contains }, { code: contains }] },
        take: LIMIT,
        include: { department: { select: { name: true } } },
      }),
      this.prisma.controlledDocument.findMany({
        where: { deletedAt: null, ...(scoped ? { departmentId } : {}), OR: [{ title: contains }, { code: contains }] },
        take: LIMIT,
        select: { id: true, title: true, code: true, department: { select: { name: true } } },
      }),
      this.prisma.businessObject.findMany({
        where: { deletedAt: null, ...(scoped ? { departmentId } : {}), OR: [{ name: contains }, { code: contains }] },
        take: LIMIT,
        include: { type: { select: { name: true } } },
      }),
      this.prisma.kpi.findMany({
        where: { ...(scoped ? { departmentId } : {}), name: contains },
        take: LIMIT,
      }),
      this.prisma.processRisk.findMany({
        where: { title: contains, ...(scoped ? { process: { departmentId } } : {}) },
        take: LIMIT,
        include: { process: { select: { id: true, name: true } } },
      }),
      this.prisma.auditTemplate.findMany({ where: { name: contains }, take: LIMIT, select: { id: true, name: true, category: true } }),
      this.prisma.audit.findMany({
        where: { title: contains, ...(scoped ? { departmentId } : {}) },
        take: LIMIT,
        include: { department: { select: { name: true } } },
      }),
      this.prisma.finding.findMany({
        where: { title: contains, ...(scoped ? { audit: { departmentId } } : {}) },
        take: LIMIT,
        include: { audit: { select: { id: true, department: { select: { name: true } } } } },
      }),
      this.prisma.capa.findMany({
        where: { deletedAt: null, OR: [{ title: contains }, { referenceNumber: contains }, { description: contains }], ...(scoped ? { departmentId } : {}) },
        take: LIMIT,
        include: { department: { select: { name: true } } },
      }),
    ]);

    const groups: SearchGroup[] = [
      {
        type: 'process' as EntityType,
        label: ENTITY_TYPE_LABELS['process'] ?? 'Processes',
        results: processes.map((process) => ({ id: process.id, title: process.name, subtitle: process.department?.name ?? null, href: `/processes/${process.id}` })),
      },
      {
        type: 'document' as EntityType,
        label: ENTITY_TYPE_LABELS['document'] ?? 'Documents',
        results: documents.map((document) => ({ id: document.id, title: document.title, subtitle: `${document.code}${document.department?.name ? ' · ' + document.department.name : ''}`, href: `/documents/${document.id}` })),
      },
      {
        type: 'business_object' as EntityType,
        label: ENTITY_TYPE_LABELS['business_object'] ?? 'Business objects',
        results: objects.map((object) => ({ id: object.id, title: object.name, subtitle: object.type?.name ?? null, href: `/business-objects/${object.id}` })),
      },
      {
        type: 'kpi' as EntityType,
        label: ENTITY_TYPE_LABELS['kpi'] ?? 'KPIs',
        results: kpis.map((kpi) => ({ id: kpi.id, title: kpi.name, subtitle: kpi.currentValue !== null ? `${kpi.currentValue}${kpi.unit ?? ''}` : null, href: `/kpis/${kpi.id}` })),
      },
      {
        type: 'risk' as EntityType,
        label: ENTITY_TYPE_LABELS['risk'] ?? 'Risks',
        results: risks.map((risk) => ({ id: risk.id, title: risk.title, subtitle: risk.process?.name ?? null, href: `/processes/${risk.process?.id ?? ''}` })),
      },
      {
        type: 'template',
        label: ENTITY_TYPE_LABELS['template'] ?? 'Audit templates',
        results: templates.map((template) => ({ id: template.id, title: template.name, subtitle: template.category, href: `/audit-templates/${template.id}` })),
      },
      {
        type: 'audit' as EntityType,
        label: ENTITY_TYPE_LABELS['audit'] ?? 'Audits',
        results: audits.map((audit) => ({ id: audit.id, title: audit.title, subtitle: audit.department?.name ?? null, href: `/audits/${audit.id}` })),
      },
      {
        type: 'finding' as EntityType,
        label: ENTITY_TYPE_LABELS['finding'] ?? 'Findings',
        results: findings.map((finding) => ({ id: finding.id, title: finding.title, subtitle: finding.audit?.department?.name ?? null, href: `/audits/${finding.audit?.id ?? ''}` })),
      },
      {
        type: 'capa',
        label: 'CAPAs',
        results: capas.map((capa) => ({ id: capa.id, title: capa.referenceNumber, subtitle: capa.title, href: `/capas/${capa.id}` })),
      },
    ].filter((group) => group.results.length > 0);

    const total = groups.reduce((sum, group) => sum + group.results.length, 0);
    return { query: term, total, groups };
  }
}

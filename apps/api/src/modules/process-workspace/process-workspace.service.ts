import { Injectable } from '@nestjs/common';
import type { ProcessWorkspaceDto } from '@tecpap/types';
import type { DataScope } from '../../common/types/data-scope';
import { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import { AuditsService } from '../audits/audits.service';
import { BusinessObjectsService } from '../business-objects/business-objects.service';
import { DocumentsService } from '../documents/documents.service';
import { KpisService } from '../kpis/kpis.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProcessRisksService } from '../process-risks/process-risks.service';
import { ProcessesService } from '../processes/processes.service';
import { ProcessAssignmentsService } from './process-assignments.service';

/**
 * Aggregates a process into a single workspace view — the "process home page".
 * Composes existing services (no duplicated data): KPIs, risks, responsibilities,
 * related documents, business objects, audits and the activity timeline.
 */
@Injectable()
export class ProcessWorkspaceService {
  constructor(
    private readonly processes: ProcessesService,
    private readonly kpis: KpisService,
    private readonly risks: ProcessRisksService,
    private readonly documents: DocumentsService,
    private readonly businessObjects: BusinessObjectsService,
    private readonly assignments: ProcessAssignmentsService,
    private readonly activity: ActivityTimelineService,
    private readonly audits: AuditsService,
    private readonly prisma: PrismaService,
  ) {}

  async workspace(processId: string, scope: DataScope | undefined): Promise<ProcessWorkspaceDto> {
    const process = await this.processes.findOne(processId, scope);

    const [kpis, risks, assignments, documents, businessObjects, timeline, auditsResult] = await Promise.all([
      this.kpis.list({ processId }, scope),
      this.risks.list({ processId }, scope),
      this.assignments.list(processId),
      this.documents.list({ processId, pageSize: '10' }, scope),
      this.businessObjects.list({ processId, pageSize: '10' }, scope),
      this.activity.listByProcess(processId, 15),
      this.audits.list({ processId, pageSize: '10' }, scope),
    ]);

    const [auditTotal, openFindings, complianceAgg, openCapas] = await Promise.all([
      this.prisma.audit.count({ where: { processId } }),
      this.prisma.finding.count({ where: { processId, status: 'OPEN' } }),
      this.prisma.audit.aggregate({ _avg: { compliance: true }, where: { processId, compliance: { not: null } } }),
      this.prisma.capa.count({ where: { processId, deletedAt: null, status: { notIn: ['CLOSED', 'CANCELLED'] } } }),
    ]);

    return {
      process,
      objectives: process.objectives,
      scope: process.scope,
      ownerName: process.ownerName,
      kpis: kpis.items,
      risks: risks.items,
      assignments,
      documents: documents.items,
      businessObjects: businessObjects.items,
      audits: auditsResult.items,
      timeline,
      stats: {
        documents: documents.total,
        businessObjects: businessObjects.total,
        kpis: kpis.total,
        openRisks: risks.items.filter((risk) => risk.status === 'OPEN').length,
        audits: auditTotal,
        openFindings,
        compliance: complianceAgg._avg.compliance ? Math.round(complianceAgg._avg.compliance) : 0,
      },
    };
  }
}

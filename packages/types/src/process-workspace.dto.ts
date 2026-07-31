import type { ActivityTimelineDto } from './activity-timeline.dto';
import type { AuditDto } from './audit.dto';
import type { BusinessObjectDto } from './business-object.dto';
import type { DocumentDto } from './document.dto';
import type { KpiDto } from './kpi.dto';
import type { ProcessAssignmentDto } from './process-assignment.dto';
import type { ProcessDto } from './process.dto';
import type { ProcessRiskDto } from './process-risk.dto';

export interface ProcessWorkspaceStatsDto {
  documents: number;
  businessObjects: number;
  kpis: number;
  openRisks: number;
  audits: number;
  openFindings: number;
  compliance: number;
}

export interface ProcessWorkspaceDto {
  process: ProcessDto;
  objectives: string | null;
  scope: string | null;
  ownerName: string | null;
  kpis: KpiDto[];
  risks: ProcessRiskDto[];
  assignments: ProcessAssignmentDto[];
  documents: DocumentDto[];
  businessObjects: BusinessObjectDto[];
  audits: AuditDto[];
  timeline: ActivityTimelineDto[];
  stats: ProcessWorkspaceStatsDto;
}

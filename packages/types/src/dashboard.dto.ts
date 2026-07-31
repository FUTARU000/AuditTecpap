import type { DocumentStatus } from './enums';
import type { FindingSeverity } from './enums';

export interface AuditDashboardStats {
  scheduled: number;
  inProgress: number;
  completed: number;
  overdue: number;
  openFindings: number;
  findingsBySeverity: Array<{ severity: FindingSeverity; count: number }>;
  complianceRate: number;
  completionRate: number;
}

export interface CapaDashboardStats {
  open: number;
  overdue: number;
  pendingVerification: number;
  pendingEffectiveness: number;
  closed: number;
}

export interface DashboardStatsDto {
  departments: number;
  processes: number;
  documents: number;
  byStatus: Array<{ status: DocumentStatus; count: number }>;
  drafts: number;
  published: number;
  expiring: number;
  awaitingApproval: number;
  recentUpdates: Array<{
    id: string;
    action: string;
    target: string | null;
    actorName: string | null;
    createdAt: string;
  }>;
  documentsAwaitingApproval: Array<{
    id: string;
    title: string;
    code: string;
    status: DocumentStatus;
    departmentName: string | null;
    updatedAt: string;
  }>;
  audits: AuditDashboardStats;
  capas: CapaDashboardStats;
}

export interface GlobalSearchResultDto {
  id: string;
  title: string;
  code: string;
  status: string;
  departmentName: string | null;
  categoryName: string | null;
  snippet: string | null;
}

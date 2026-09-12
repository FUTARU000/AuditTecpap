import type { DocumentStatus } from './enums';
import type { FindingSeverity } from './enums';

/** High-level KPI strip — one number per currently active module, each backed by an existing, reliable query. */
export interface DashboardOverviewDto {
  departments: number;
  activeDocuments: number;
  activeIndicators: number;
  openFindings: number;
  openCapas: number;
  auditsInProgress: number;
}

export interface DashboardDocumentControlDto {
  totalActive: number;
  awaitingApproval: number;
  drafts: number;
  expiringSoon: number;
}

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
  awaitingVerification: number;
  returned: number;
  validated: number;
  overdue: number;
}

/** Uses the existing evaluateIndicator() status classification — never a separately invented metric. */
export interface DashboardIndicatorsSummaryDto {
  active: number;
  onTarget: number;
  warning: number;
  critical: number;
  noData: number;
}

export interface DashboardAttentionItemDto {
  type:
    | 'CRITICAL_INDICATOR'
    | 'OVERDUE_AUDIT'
    | 'OVERDUE_CAPA'
    | 'DOCUMENT_AWAITING_APPROVAL'
    | 'RETURNED_CAPA';
  id: string;
  title: string;
  href: string;
  detail: string | null;
}

export interface DashboardStatsDto {
  overview: DashboardOverviewDto;
  documents: DashboardDocumentControlDto;
  audits: AuditDashboardStats;
  capas: CapaDashboardStats;
  indicators: DashboardIndicatorsSummaryDto;
  /** Actionable items across modules, most urgent first — capped, not exhaustive. */
  requiresAttention: DashboardAttentionItemDto[];
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
  upcomingAudits: Array<{
    id: string;
    title: string;
    departmentName: string | null;
    scheduledDate: string | null;
  }>;
  // Phase 7.7 — TECPAP role-scoped workflow metrics (optional, populated by role)
  capasToVerify?: number;
  capasToValidate?: number;
  capasReturned?: number;
  myActionsPending?: number;
  myReturnedCapas?: number;
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

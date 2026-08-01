/**
 * Phase 7.5 — Workflow, Notifications & Productivity DTOs.
 */

export type NotificationSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL';

/** Notification event types — the catalog of events the platform can raise. */
export type NotificationType =
  | 'DOCUMENT_AWAITING_APPROVAL'
  | 'DOCUMENT_APPROVED'
  | 'DOCUMENT_REJECTED'
  | 'DOCUMENT_NEW_VERSION'
  | 'DOCUMENT_REVIEW_OVERDUE'
  | 'AUDIT_ASSIGNED'
  | 'AUDIT_STARTING_SOON'
  | 'AUDIT_OVERDUE'
  | 'FINDING_ASSIGNED'
  | 'CAPA_ASSIGNED'
  | 'CAPA_DUE'
  | 'CAPA_OVERDUE'
  | 'CAPA_COMPLETED'
  | 'RISK_CREATED'
  | 'RISK_SCORE_INCREASED'
  | 'KPI_THRESHOLD_EXCEEDED'
  | 'CERTIFICATE_EXPIRING'
  | 'IMPORT_COMPLETED'
  | 'IMPORT_REQUIRES_REVIEW'
  | 'SYSTEM';

export interface NotificationDto {
  id: string;
  type: string;
  category: string;
  severity: NotificationSeverity;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  actionUrl: string | null;
  departmentId: string | null;
  readAt: string | null;
  archivedAt: string | null;
  createdAt: string;
}

export interface CalendarEventDto {
  id: string;
  title: string;
  date: string;
  endDate: string | null;
  type: 'audit' | 'capa' | 'document' | 'finding' | 'risk';
  entityType: string;
  entityId: string;
  href: string;
  status: string | null;
  priority: string | null;
}

export interface UserTaskDto {
  id: string;
  source: string;
  entityType: string;
  entityId: string;
  title: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  dueDate: string | null;
  href: string | null;
  completed: boolean;
  dismissed: boolean;
  createdAt: string;
}

export interface FavoriteDto {
  id: string;
  entityType: string;
  entityId: string;
  label: string;
  href: string;
  icon: string | null;
  createdAt: string;
}

export interface RecentItemDto {
  id: string;
  entityType: string;
  entityId: string;
  label: string;
  href: string;
  viewedAt: string;
}

export interface ReportSubscriptionDto {
  id: string;
  reportType: string;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  channel: string;
  active: boolean;
  createdAt: string;
}

export interface WorkspaceDto {
  audits: { id: string; title: string; status: string; scheduledDate: string | null; href: string }[];
  capas: { id: string; title: string; status: string; targetDate: string | null; priority: string; href: string }[];
  findings: { id: string; title: string; severity: string; status: string; href: string }[];
  pendingApprovals: { id: string; title: string; code: string; status: string; type: string; href: string }[];
  imports: { id: string; name: string; status: string; pending: number; href: string }[];
  kpis: { id: string; name: string; currentValue: number | null; target: number | null; unit: string | null; href: string }[];
  upcomingDeadlines: { title: string; date: string; type: string; href: string }[];
  unreadNotifications: number;
  openTasks: number;
  departmentName: string | null;
}

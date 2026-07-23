/** Immutable audit-log entry. Append-only — never updated or deleted. */
export interface AuditLogDto {
  id: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  target: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

/** Canonical administrative actions recorded in the audit log. */
export const AUDIT_ACTIONS = {
  AUTH_LOGIN: 'auth.login',
  AUTH_LOGIN_FAILED: 'auth.login_failed',
  AUTH_LOGOUT: 'auth.logout',
  AUTH_REFRESH: 'auth.refresh',
  USER_CREATE: 'user.create',
  USER_UPDATE: 'user.update',
  USER_STATUS_CHANGE: 'user.status_change',
  USER_ROLE_CHANGE: 'user.role_change',
  USER_DEPARTMENT_CHANGE: 'user.department_change',
  USER_PASSWORD_RESET: 'user.password_reset',
  USER_PASSWORD_CHANGE: 'user.password_change',
  ROLE_CREATE: 'role.create',
  ROLE_UPDATE: 'role.update',
  ROLE_DELETE: 'role.delete',
  ROLE_PERMISSIONS_CHANGE: 'role.permissions_change',
  DEPARTMENT_CREATE: 'department.create',
  DEPARTMENT_UPDATE: 'department.update',
  DEPARTMENT_DELETE: 'department.delete',
  DEPARTMENT_MANAGER_CHANGE: 'department.manager_change',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

/**
 * Permission catalog — the single source of truth for DB-driven RBAC.
 *
 * Format: '<resource>.<action>'. These are seeded into the `permissions` table
 * (with their group) and attached to roles through the role↔permission relation.
 * Guards NEVER hardcode permissions: they read required keys from @Permissions()
 * and check them against the principal's DB-loaded permission set.
 *
 * Add new permissions here first, then re-seed.
 */

export interface PermissionDefinition {
  key: string;
  label: string;
  description?: string;
}

export interface PermissionGroup {
  /** Display name for grouping in the Permissions page and Roles matrix. */
  group: string;
  permissions: PermissionDefinition[];
}

export const PERMISSION_CATALOG: PermissionGroup[] = [
  {
    group: 'Users',
    permissions: [
      { key: 'users.read', label: 'View users', description: 'List and open user profiles' },
      { key: 'users.create', label: 'Create users', description: 'Invite new users' },
      { key: 'users.update', label: 'Edit users', description: 'Update user details' },
      { key: 'users.delete', label: 'Deactivate users', description: 'Soft-delete (never permanent)' },
      { key: 'users.reset_password', label: 'Reset passwords', description: 'Force a password reset' },
      { key: 'users.activate', label: 'Activate / deactivate', description: 'Change user status' },
      { key: 'users.assign_role', label: 'Assign roles', description: 'Change a user role' },
      { key: 'users.assign_department', label: 'Assign departments', description: 'Move users between departments' },
    ],
  },
  {
    group: 'Roles',
    permissions: [
      { key: 'roles.read', label: 'View roles' },
      { key: 'roles.create', label: 'Create roles' },
      { key: 'roles.update', label: 'Edit roles' },
      { key: 'roles.delete', label: 'Delete roles' },
      { key: 'roles.assign_permissions', label: 'Assign permissions', description: 'Edit a role permission set' },
    ],
  },
  {
    group: 'Permissions',
    permissions: [{ key: 'permissions.read', label: 'View the permission catalog' }],
  },
  {
    group: 'Departments',
    permissions: [
      { key: 'departments.read', label: 'View departments' },
      { key: 'departments.create', label: 'Create departments' },
      { key: 'departments.update', label: 'Edit departments' },
      { key: 'departments.delete', label: 'Delete departments' },
      { key: 'departments.assign_manager', label: 'Assign managers' },
      { key: 'departments.assign_users', label: 'Assign users to departments' },
    ],
  },
  {
    group: 'Audit log',
    permissions: [{ key: 'audit-log.read', label: 'View the audit log' }],
  },
  {
    group: 'Dashboard',
    permissions: [{ key: 'dashboard.read', label: 'View dashboards' }],
  },
  {
    group: 'Settings',
    permissions: [
      { key: 'settings.read', label: 'View system settings' },
      { key: 'settings.update', label: 'Manage system settings' },
    ],
  },
  // ---- Forward-looking modules (keys seeded now; enforced in later phases) ----
  {
    group: 'Templates',
    permissions: [
      { key: 'templates.read', label: 'View templates' },
      { key: 'templates.create', label: 'Create templates' },
      { key: 'templates.update', label: 'Edit templates' },
      { key: 'templates.delete', label: 'Delete templates' },
      { key: 'templates.import', label: 'Import templates' },
    ],
  },
  {
    group: 'Audits',
    permissions: [
      { key: 'audits.read', label: 'View audits' },
      { key: 'audits.create', label: 'Schedule audits' },
      { key: 'audits.update', label: 'Edit audits' },
      { key: 'audits.delete', label: 'Delete audits' },
      { key: 'audits.execute', label: 'Execute audits' },
      { key: 'audits.submit', label: 'Submit audits' },
      { key: 'audits.validate', label: 'Validate audits' },
    ],
  },
  {
    group: 'Findings',
    permissions: [
      { key: 'findings.read', label: 'View findings' },
      { key: 'findings.create', label: 'Create findings' },
      { key: 'findings.update', label: 'Edit findings' },
      { key: 'findings.delete', label: 'Delete findings' },
    ],
  },
  {
    group: 'Corrective actions',
    permissions: [
      { key: 'actions.read', label: 'View corrective actions' },
      { key: 'actions.create', label: 'Create corrective actions' },
      { key: 'actions.update', label: 'Edit corrective actions' },
      { key: 'actions.submit', label: 'Submit for validation' },
      { key: 'actions.validate', label: 'Validate corrective actions' },
    ],
  },
  {
    group: 'Documents',
    permissions: [
      { key: 'documents.read', label: 'View documents' },
      { key: 'documents.create', label: 'Upload documents' },
      { key: 'documents.update', label: 'Edit documents' },
      { key: 'documents.delete', label: 'Delete documents' },
    ],
  },
  {
    group: 'Certificates',
    permissions: [
      { key: 'certificates.read', label: 'View certificates' },
      { key: 'certificates.create', label: 'Register certificates' },
      { key: 'certificates.update', label: 'Edit certificates' },
      { key: 'certificates.delete', label: 'Delete certificates' },
    ],
  },
  {
    group: 'Reports',
    permissions: [
      { key: 'reports.read', label: 'View reports' },
      { key: 'reports.export', label: 'Export reports' },
    ],
  },
  {
    group: 'AI',
    permissions: [{ key: 'ai.use', label: 'Use AI features (when enabled)' }],
  },
];

/** Flat list of every permission key. */
export const ALL_PERMISSIONS: readonly string[] = PERMISSION_CATALOG.flatMap((g) =>
  g.permissions.map((p) => p.key),
);

export type PermissionKey = (typeof ALL_PERMISSIONS)[number];

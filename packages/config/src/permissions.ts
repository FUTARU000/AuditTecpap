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
      {
        key: 'users.delete',
        label: 'Deactivate users',
        description: 'Soft-delete (never permanent)',
      },
      {
        key: 'users.reset_password',
        label: 'Reset passwords',
        description: 'Force a password reset',
      },
      { key: 'users.activate', label: 'Activate / deactivate', description: 'Change user status' },
      { key: 'users.assign_role', label: 'Assign roles', description: 'Change a user role' },
      {
        key: 'users.assign_department',
        label: 'Assign departments',
        description: 'Move users between departments',
      },
    ],
  },
  {
    group: 'Roles',
    permissions: [
      { key: 'roles.read', label: 'View roles' },
      { key: 'roles.create', label: 'Create roles' },
      { key: 'roles.update', label: 'Edit roles' },
      { key: 'roles.delete', label: 'Delete roles' },
      {
        key: 'roles.assign_permissions',
        label: 'Assign permissions',
        description: 'Edit a role permission set',
      },
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
    group: 'Processes',
    permissions: [
      { key: 'processes.read', label: 'View processes', description: 'List and open processes' },
      { key: 'processes.create', label: 'Create processes' },
      { key: 'processes.update', label: 'Edit processes' },
      { key: 'processes.delete', label: 'Archive processes' },
    ],
  },
  {
    group: 'Document categories',
    permissions: [
      { key: 'categories.read', label: 'View document categories' },
      { key: 'categories.manage', label: 'Manage document categories' },
    ],
  },
  {
    group: 'Controlled documents',
    permissions: [
      { key: 'documents.read', label: 'View documents' },
      { key: 'documents.create', label: 'Create documents' },
      { key: 'documents.update', label: 'Edit documents' },
      { key: 'documents.delete', label: 'Delete documents' },
      {
        key: 'documents.upload_version',
        label: 'Upload new versions',
        description: 'Attach a file as a new immutable version',
      },
      {
        key: 'documents.approve_version',
        label: 'Approve versions',
        description: 'Mark a version approved',
      },
      {
        key: 'documents.manage_relations',
        label: 'Manage relationships',
        description: 'Link documents (uses/generates/references/…)',
      },
      {
        key: 'documents.approve',
        label: 'Approve documents',
        description: 'Move a document to Approved',
      },
      {
        key: 'documents.publish',
        label: 'Publish documents',
        description: 'Move a document to Published',
      },
      { key: 'documents.archive', label: 'Archive documents' },
      { key: 'documents.restore', label: 'Restore documents' },
    ],
  },
  {
    group: 'Dashboard',
    permissions: [{ key: 'dashboard.read', label: 'View dashboards' }],
  },
  {
    group: 'Audit templates',
    permissions: [
      { key: 'templates.read', label: 'View audit templates' },
      { key: 'templates.create', label: 'Create templates' },
      { key: 'templates.update', label: 'Edit templates' },
      { key: 'templates.delete', label: 'Delete templates' },
      { key: 'templates.publish', label: 'Publish / archive templates' },
      { key: 'templates.clone', label: 'Clone templates' },
    ],
  },
  {
    group: 'Audits',
    permissions: [
      { key: 'audits.read', label: 'View audits' },
      { key: 'audits.create', label: 'Create audits' },
      { key: 'audits.execute', label: 'Execute audits (answer questions)' },
      { key: 'audits.submit', label: 'Submit audits' },
      { key: 'audits.review', label: 'Review audits' },
      { key: 'audits.approve', label: 'Approve / return audits' },
    ],
  },
  {
    group: 'Findings & evidence',
    permissions: [
      { key: 'findings.read', label: 'View findings' },
      { key: 'findings.create', label: 'Create findings' },
      { key: 'findings.update', label: 'Edit findings' },
      { key: 'evidence.upload', label: 'Upload evidence' },
      { key: 'reports.export', label: 'Export audit reports' },
    ],
  },
  {
    group: 'CAPA',
    permissions: [
      { key: 'capas.read', label: 'View CAPAs' },
      { key: 'capas.create', label: 'Create CAPAs' },
      { key: 'capas.update', label: 'Edit CAPAs' },
      { key: 'capas.assign', label: 'Assign CAPA owners / actions' },
      { key: 'capas.verify', label: 'Verify CAPA completion' },
      { key: 'capas.effectiveness_review', label: 'Perform effectiveness review' },
      { key: 'capas.close', label: 'Close CAPAs' },
      { key: 'capas.export', label: 'Export CAPA reports' },
      {
        key: 'capas.submit',
        label: 'Submit CAPA for verification',
        description: 'Pilot submits corrective action work for Audit Manager review',
      },
      {
        key: 'capas.rework',
        label: 'Respond to CAPA rework',
        description: 'Pilot reworks after return from verification',
      },
    ],
  },
  {
    group: 'CAPA actions',
    permissions: [
      { key: 'capa_actions.read', label: 'View CAPA actions' },
      { key: 'capa_actions.create', label: 'Create CAPA actions' },
      { key: 'capa_actions.update', label: 'Edit CAPA actions' },
      { key: 'capa_actions.complete', label: 'Complete assigned actions' },
    ],
  },
  {
    group: 'Business objects',
    permissions: [
      { key: 'business_objects.read', label: 'View business objects' },
      { key: 'business_objects.create', label: 'Create business objects' },
      { key: 'business_objects.update', label: 'Edit business objects' },
      { key: 'business_objects.delete', label: 'Delete business objects' },
    ],
  },
  {
    group: 'KPIs',
    permissions: [
      { key: 'kpis.read', label: 'View KPIs' },
      { key: 'kpis.create', label: 'Create KPIs' },
      { key: 'kpis.update', label: 'Edit KPIs (incl. recording values)' },
      { key: 'kpis.delete', label: 'Delete KPIs' },
    ],
  },
  {
    group: 'Indicators',
    permissions: [
      {
        key: 'indicators.read',
        label: 'View indicators',
        description: 'List and open quality indicators',
      },
      { key: 'indicators.create', label: 'Create indicators' },
      {
        key: 'indicators.update',
        label: 'Edit indicators',
        description:
          'Edit definition: department, thresholds, frequency, responsible user, active status',
      },
      {
        key: 'indicators.values.create',
        label: 'Record indicator values',
        description: 'Add or correct a measured value',
      },
      { key: 'indicators.values.read', label: 'View indicator value history' },
    ],
  },
  {
    group: 'Process risks',
    permissions: [
      { key: 'risks.read', label: 'View process risks' },
      { key: 'risks.create', label: 'Create risks' },
      { key: 'risks.update', label: 'Edit risks' },
      { key: 'risks.delete', label: 'Delete risks' },
    ],
  },
  {
    group: 'Import',
    permissions: [
      {
        key: 'imports.read',
        label: 'View import jobs & review queue',
        description: 'List jobs, items and statistics (department-scoped)',
      },
      {
        key: 'imports.start',
        label: 'Start import jobs',
        description: 'Scan a folder / upload files into an import job',
      },
      {
        key: 'imports.review',
        label: 'Review imports',
        description: 'Approve, reject, merge or replace versions',
      },
      {
        key: 'imports.cancel',
        label: 'Cancel / retry / delete jobs',
        description: 'Manage job lifecycle',
      },
      {
        key: 'imports.stats',
        label: 'View import statistics',
        description: 'Roll-up import dashboard metrics',
      },
    ],
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

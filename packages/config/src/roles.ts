import { ALL_PERMISSIONS } from './permissions';

/** Machine slugs for the three system roles. */
export const SYSTEM_ROLE_SLUGS = {
  ADMIN: 'administrator',
  AUDIT_MANAGER: 'audit-manager',
  PILOT: 'pilot',
} as const;

export type SystemRoleSlug = (typeof SYSTEM_ROLE_SLUGS)[keyof typeof SYSTEM_ROLE_SLUGS];

export interface SystemRoleDefinition {
  name: string;
  slug: string;
  description: string;
  isSystem: true;
  /** Global roles bypass department data-scoping. */
  isGlobal: boolean;
  permissions: readonly string[];
}

/**
 * Default permissions for the Audit Manager: full audit programme + read access
 * across departments, but NO identity/role/permission/settings administration.
 */
const MANAGER_PERMISSIONS = [
  'dashboard.read',
  'departments.read',
  // Audit programme (full)
  'templates.read',
  'templates.create',
  'templates.update',
  'templates.delete',
  'templates.import',
  'audits.read',
  'audits.create',
  'audits.update',
  'audits.execute',
  'audits.submit',
  'audits.validate',
  'findings.read',
  'findings.create',
  'findings.update',
  'findings.delete',
  'actions.read',
  'actions.create',
  'actions.update',
  'actions.submit',
  'actions.validate',
  // Documents & certificates
  'documents.read',
  'documents.create',
  'documents.update',
  'documents.delete',
  'certificates.read',
  'certificates.create',
  'certificates.update',
  'certificates.delete',
  // Reporting
  'reports.read',
  'reports.export',
  'ai.use',
];

/**
 * Default permissions for a Pilot: department-scoped execution only.
 * Department scoping is enforced in the repository layer (DataScope).
 */
const PILOT_PERMISSIONS = [
  'dashboard.read',
  'departments.read',
  'templates.read',
  'audits.read',
  'audits.execute',
  'audits.submit',
  'findings.read',
  'findings.create',
  'findings.update',
  'actions.read',
  'actions.create',
  'actions.update',
  'actions.submit',
  'documents.read',
  'certificates.read',
  'reports.read',
];

/**
 * The three system roles. `isSystem` prevents their deletion; Administrators can
 * still edit their permission sets. Custom roles are creatable at runtime.
 */
export const SYSTEM_ROLES: SystemRoleDefinition[] = [
  {
    name: 'Administrator',
    slug: SYSTEM_ROLE_SLUGS.ADMIN,
    description: 'Full platform governance',
    isSystem: true,
    isGlobal: true,
    permissions: ALL_PERMISSIONS,
  },
  {
    name: 'Audit Manager',
    slug: SYSTEM_ROLE_SLUGS.AUDIT_MANAGER,
    description: 'Runs the audit programme',
    isSystem: true,
    isGlobal: true,
    permissions: MANAGER_PERMISSIONS,
  },
  {
    name: 'Pilot',
    slug: SYSTEM_ROLE_SLUGS.PILOT,
    description: 'Department-scoped executor',
    isSystem: true,
    isGlobal: false,
    permissions: PILOT_PERMISSIONS,
  },
];

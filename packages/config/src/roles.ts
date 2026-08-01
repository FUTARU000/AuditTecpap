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
  // Quality management (full)
  'processes.read',
  'processes.create',
  'processes.update',
  'processes.delete',
  'categories.read',
  'documents.read',
  'documents.create',
  'documents.update',
  'documents.delete',
  'documents.upload_version',
  'documents.approve_version',
  'documents.manage_relations',
  'documents.approve',
  'documents.publish',
  'documents.archive',
  'documents.restore',
  // Phase 4 — operational management (full)
  'business_objects.read',
  'business_objects.create',
  'business_objects.update',
  'business_objects.delete',
  'kpis.read',
  'kpis.create',
  'kpis.update',
  'kpis.delete',
  'risks.read',
  'risks.create',
  'risks.update',
  'risks.delete',
  // Phase 5 — audit programme (full)
  'templates.read',
  'templates.create',
  'templates.update',
  'templates.delete',
  'templates.publish',
  'templates.clone',
  'audits.read',
  'audits.create',
  'audits.execute',
  'audits.submit',
  'audits.review',
  'audits.approve',
  'findings.read',
  'findings.create',
  'findings.update',
  'evidence.upload',
  'reports.export',
  // Phase 6 — CAPA (full)
  'capas.read', 'capas.create', 'capas.update', 'capas.assign',
  'capas.verify', 'capas.effectiveness_review', 'capas.close', 'capas.export',
  'capa_actions.read', 'capa_actions.create', 'capa_actions.update', 'capa_actions.complete',
  // Phase 7 — Legacy QMS import (full: run, review, govern)
  'imports.read', 'imports.start', 'imports.review', 'imports.cancel', 'imports.stats',
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
  // Quality management (department-scoped read + contribute)
  'processes.read',
  'categories.read',
  'documents.create',
  'documents.update',
  'documents.upload_version',
  // Phase 4 — operational management (department-scoped contribute)
  'business_objects.read',
  'business_objects.create',
  'business_objects.update',
  'kpis.read',
  'risks.read',
  // Phase 5 — audit execution (department-scoped)
  'templates.read',
  'audits.read',
  'audits.create',
  'audits.execute',
  'audits.submit',
  'findings.read',
  'findings.create',
  'findings.update',
  'evidence.upload',
  // Phase 6 — CAPA (department-scoped)
  'capas.read', 'capa_actions.read', 'capa_actions.update', 'capa_actions.complete',
  // Phase 7 — Legacy QMS import (view own department's imports)
  'imports.read',
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

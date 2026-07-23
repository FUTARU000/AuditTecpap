/**
 * Application-wide constants shared across the monorepo.
 * Keep this file free of runtime side-effects.
 */

export const APP_NAME = 'TECPAP Audit Platform';
export const APP_SHORT_NAME = 'TECPAP Audit';
export const APP_VERSION = '0.2.0';

/** Default pagination settings for list endpoints. */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/** The nine TECPAP departments, seeded at bootstrap (order as specified). */
export interface DepartmentSeed {
  code: string;
  name: string;
  description: string;
  sortOrder: number;
}

export const DEPARTMENTS: readonly DepartmentSeed[] = [
  { code: 'PROD', name: 'Production', description: 'Manufacturing and production lines', sortOrder: 1 },
  { code: 'QUAL', name: 'Quality', description: 'Quality assurance and control', sortOrder: 2 },
  { code: 'MAINT', name: 'Maintenance', description: 'Equipment and facilities maintenance', sortOrder: 3 },
  { code: 'PUR', name: 'Purchasing', description: 'Procurement and suppliers', sortOrder: 4 },
  { code: 'HR', name: 'Human Resources', description: 'People and administration', sortOrder: 5 },
  { code: 'FIN', name: 'Finance', description: 'Accounting and finance', sortOrder: 6 },
  { code: 'LOG', name: 'Logistics', description: 'Warehousing and distribution', sortOrder: 7 },
  { code: 'COM', name: 'Commercial', description: 'Sales and customer relations', sortOrder: 8 },
  { code: 'IT', name: 'IT', description: 'Information technology', sortOrder: 9 },
];

/** Reminder lead-times (in days) for certificate/document expiration. */
export const DEFAULT_REMINDER_DAYS = [90, 60, 30, 7] as const;

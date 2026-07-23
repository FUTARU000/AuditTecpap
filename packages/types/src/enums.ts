/**
 * Domain enums shared across frontend and backend.
 * Roles are dynamic (custom roles are creatable), so `Role` is a string slug.
 */

export type Role = string;

export const USER_STATUS = ['ACTIVE', 'INACTIVE', 'LOCKED'] as const;
export type UserStatus = (typeof USER_STATUS)[number];

export const DEPARTMENT_STATUS = ['ACTIVE', 'INACTIVE'] as const;
export type DepartmentStatus = (typeof DEPARTMENT_STATUS)[number];

// Re-export identity primitives (single source: @tecpap/config).
export type { PermissionKey, SystemRoleSlug } from '@tecpap/config';

/**
 * Domain enums shared across frontend and backend.
 * Roles are dynamic (custom roles are creatable), so `Role` is a string slug.
 */

export type Role = string;

export const USER_STATUS = ['ACTIVE', 'INACTIVE', 'LOCKED'] as const;
export type UserStatus = (typeof USER_STATUS)[number];

export const DEPARTMENT_STATUS = ['ACTIVE', 'INACTIVE'] as const;
export type DepartmentStatus = (typeof DEPARTMENT_STATUS)[number];

export const PROCESS_STATUS = ['ACTIVE', 'INACTIVE', 'ARCHIVED'] as const;
export type ProcessStatus = (typeof PROCESS_STATUS)[number];

export const DOCUMENT_STATUS = ['DRAFT', 'UNDER_REVIEW', 'APPROVED', 'PUBLISHED', 'OBSOLETE', 'ARCHIVED'] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUS)[number];

// Re-export identity + QMS + audit primitives (single source: @tecpap/config).
export type { PermissionKey, SystemRoleSlug } from '@tecpap/config';
export type { RelationType, ConfidentialityLevel } from '@tecpap/config';
export type { QuestionType, TemplateStatus, AuditStatus, FindingSeverity } from '@tecpap/config';
export type { CapaStatus, CapaPriority, CapaActionType, CapaActionStatus, VerificationResult, EffectivenessResult, CapaSource, FindingCapaDecision } from '@tecpap/config';

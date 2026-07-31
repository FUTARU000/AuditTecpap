/**
 * Phase 5 — Audit Management & Digital Checklist Engine.
 * Catalogs are configurable constants; statuses/severities are typed unions.
 */

export const QUESTION_TYPES = [
  'YES_NO',
  'YES_NO_NA',
  'SHORT_TEXT',
  'LONG_TEXT',
  'NUMBER',
  'DATE',
  'DROPDOWN',
  'CHECKBOX',
  'MULTIPLE_CHOICE',
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  YES_NO: 'Yes / No',
  YES_NO_NA: 'Yes / No / N.A.',
  SHORT_TEXT: 'Short text',
  LONG_TEXT: 'Long text',
  NUMBER: 'Number',
  DATE: 'Date',
  DROPDOWN: 'Dropdown',
  CHECKBOX: 'Checkbox',
  MULTIPLE_CHOICE: 'Multiple choice',
};

export const TEMPLATE_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
export type TemplateStatus = (typeof TEMPLATE_STATUSES)[number];

export const AUDIT_STATUSES = ['PLANNED', 'IN_PROGRESS', 'SUBMITTED', 'UNDER_REVIEW', 'RETURNED', 'APPROVED', 'COMPLETED'] as const;
export type AuditStatus = (typeof AUDIT_STATUSES)[number];

export const AUDIT_STATUS_LABELS: Record<AuditStatus, string> = {
  PLANNED: 'Planned',
  IN_PROGRESS: 'In progress',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under review',
  RETURNED: 'Returned',
  APPROVED: 'Approved',
  COMPLETED: 'Completed',
};

export const FINDING_SEVERITIES = ['OBSERVATION', 'OFI', 'MINOR_NC', 'MAJOR_NC'] as const;
export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];

export const FINDING_SEVERITY_LABELS: Record<FindingSeverity, string> = {
  OBSERVATION: 'Observation',
  OFI: 'Opportunity for improvement',
  MINOR_NC: 'Minor non-conformity',
  MAJOR_NC: 'Major non-conformity',
};

export const FINDING_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

/** Configurable template categories (administrators can extend via the catalog). */
export const TEMPLATE_CATEGORIES = [
  'Quality Audit',
  'Process Audit',
  'Food Safety Audit',
  'Internal Audit',
  'Supplier Audit',
  'Compliance Audit',
] as const;

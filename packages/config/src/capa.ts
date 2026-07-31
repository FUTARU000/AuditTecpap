/**
 * Phase 6 — CAPA & Continuous Improvement.
 * Statuses, priorities, action types, and workflow transitions.
 */

export const CAPA_STATUSES = [
  'DRAFT',
  'ROOT_CAUSE_ANALYSIS',
  'ACTION_PLAN',
  'IN_PROGRESS',
  'PENDING_VERIFICATION',
  'PENDING_EFFECTIVENESS',
  'CLOSED',
  'CANCELLED',
] as const;
export type CapaStatus = (typeof CAPA_STATUSES)[number];

export const CAPA_STATUS_LABELS: Record<CapaStatus, string> = {
  DRAFT: 'Draft',
  ROOT_CAUSE_ANALYSIS: 'Root Cause Analysis',
  ACTION_PLAN: 'Action Plan',
  IN_PROGRESS: 'In Progress',
  PENDING_VERIFICATION: 'Pending Verification',
  PENDING_EFFECTIVENESS: 'Pending Effectiveness',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
};

/** Allowed status transitions — enforced at the service layer. */
export const CAPA_TRANSITIONS: Record<string, readonly string[]> = {
  DRAFT: ['ROOT_CAUSE_ANALYSIS', 'CANCELLED'],
  ROOT_CAUSE_ANALYSIS: ['ACTION_PLAN', 'CANCELLED'],
  ACTION_PLAN: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['PENDING_VERIFICATION', 'ACTION_PLAN', 'CANCELLED'],
  PENDING_VERIFICATION: ['PENDING_EFFECTIVENESS', 'IN_PROGRESS'],
  PENDING_EFFECTIVENESS: ['CLOSED', 'IN_PROGRESS', 'ACTION_PLAN'],
  CLOSED: [],
  CANCELLED: [],
};

export const CAPA_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type CapaPriority = (typeof CAPA_PRIORITIES)[number];

export const CAPA_ACTION_TYPES = ['CONTAINMENT', 'CORRECTIVE', 'PREVENTIVE'] as const;
export type CapaActionType = (typeof CAPA_ACTION_TYPES)[number];

export const CAPA_ACTION_STATUSES = ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED', 'CANCELLED'] as const;
export type CapaActionStatus = (typeof CAPA_ACTION_STATUSES)[number];

export const VERIFICATION_RESULTS = ['PASSED', 'FAILED'] as const;
export type VerificationResult = (typeof VERIFICATION_RESULTS)[number];

export const EFFECTIVENESS_RESULTS = ['EFFECTIVE', 'PARTIALLY_EFFECTIVE', 'INEFFECTIVE'] as const;
export type EffectivenessResult = (typeof EFFECTIVENESS_RESULTS)[number];

export const CAPA_SOURCES = ['FINDING', 'MANUAL'] as const;
export type CapaSource = (typeof CAPA_SOURCES)[number];

export const FINDING_CAPA_DECISIONS = ['REQUIRED', 'NOT_REQUIRED'] as const;
export type FindingCapaDecision = (typeof FINDING_CAPA_DECISIONS)[number];

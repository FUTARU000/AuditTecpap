/**
 * Phase 6 / Phase 7.7 — CAPA & Continuous Improvement.
 * Statuses, priorities, action types, and workflow transitions.
 *
 * Phase 7.7 adds the TECPAP-validated workflow states (ASSIGNED, EVIDENCE_UPLOADED,
 * RETURNED, VALIDATED) alongside the legacy states. Both coexist — old CAPAs use
 * the legacy path; new CAPAs created from findings enter the TECPAP path.
 */

export const CAPA_STATUSES = [
  // Legacy statuses (Phase 6)
  'DRAFT',
  'ROOT_CAUSE_ANALYSIS',
  'ACTION_PLAN',
  'IN_PROGRESS',
  'PENDING_VERIFICATION',
  'PENDING_EFFECTIVENESS',
  'CLOSED',
  'CANCELLED',
  // TECPAP workflow statuses (Phase 7.7)
  'ASSIGNED',
  'EVIDENCE_UPLOADED',
  'RETURNED',
  'VALIDATED',
] as const;
export type CapaStatus = (typeof CAPA_STATUSES)[number];

export const CAPA_STATUS_LABELS: Record<CapaStatus, string> = {
  DRAFT: 'Draft',
  ROOT_CAUSE_ANALYSIS: 'Root Cause Analysis',
  ACTION_PLAN: 'Action Plan',
  IN_PROGRESS: 'Corrective Action In Progress',
  PENDING_VERIFICATION: 'Awaiting Verification',
  PENDING_EFFECTIVENESS: 'Pending Effectiveness',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
  ASSIGNED: 'Assigned',
  EVIDENCE_UPLOADED: 'Evidence Uploaded',
  RETURNED: 'Returned for Rework',
  VALIDATED: 'Validated',
};

/**
 * TECPAP visual workflow stages — used by the frontend progress visualizer.
 * Each status maps to one of these 7 stages (legacy statuses collapse gracefully).
 */
export const CAPA_STAGES = [
  'ASSIGNED',
  'IN_PROGRESS',
  'EVIDENCE_UPLOADED',
  'AWAITING_VERIFICATION',
  'RETURNED',
  'VALIDATED',
  'CLOSED',
] as const;
export type CapaStage = (typeof CAPA_STAGES)[number];

/** Maps every CapaStatus to a visual stage for the progress bar. */
export const CAPA_STAGE_MAP: Record<CapaStatus, CapaStage | null> = {
  // Legacy → collapse to nearest stage
  DRAFT: 'ASSIGNED',
  ROOT_CAUSE_ANALYSIS: 'ASSIGNED',
  ACTION_PLAN: 'ASSIGNED',
  // TECPAP direct mappings
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  EVIDENCE_UPLOADED: 'EVIDENCE_UPLOADED',
  PENDING_VERIFICATION: 'AWAITING_VERIFICATION',
  RETURNED: 'RETURNED',
  VALIDATED: 'VALIDATED',
  PENDING_EFFECTIVENESS: 'VALIDATED',
  CLOSED: 'CLOSED',
  CANCELLED: null,
};

/**
 * Allowed status transitions — enforced at the service layer.
 * Extended in Phase 7.7 to support the TECPAP workflow alongside legacy paths.
 */
export const CAPA_TRANSITIONS: Record<string, readonly string[]> = {
  // Legacy paths (backward-compatible)
  DRAFT: ['ROOT_CAUSE_ANALYSIS', 'ASSIGNED', 'CANCELLED'],
  ROOT_CAUSE_ANALYSIS: ['ACTION_PLAN', 'CANCELLED'],
  ACTION_PLAN: ['IN_PROGRESS', 'CANCELLED'],
  // TECPAP paths
  ASSIGNED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['EVIDENCE_UPLOADED', 'PENDING_VERIFICATION', 'ACTION_PLAN', 'CANCELLED'],
  EVIDENCE_UPLOADED: ['PENDING_VERIFICATION', 'IN_PROGRESS'],
  PENDING_VERIFICATION: ['VALIDATED', 'RETURNED', 'PENDING_EFFECTIVENESS', 'IN_PROGRESS'],
  RETURNED: ['IN_PROGRESS'],
  VALIDATED: ['CLOSED', 'IN_PROGRESS'],
  // Legacy effectiveness path
  PENDING_EFFECTIVENESS: ['CLOSED', 'IN_PROGRESS', 'ACTION_PLAN'],
  // Terminal
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

/** Finding severities that trigger automatic CAPA creation (TECPAP business rule). */
export const AUTO_CAPA_SEVERITIES = ['MAJOR_NC', 'MINOR_NC'] as const;

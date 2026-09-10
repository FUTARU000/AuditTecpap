/**
 * Phase 7.7 — Generic workflow abstraction types.
 * The CAPA workflow is the first consumer; future workflows (Purchasing,
 * Supplier Qualification, etc.) reuse these concepts without changes.
 */

export interface WorkflowStep {
  key: string;
  label: string;
  /** Visual stage for progress display (groups statuses into stages). */
  stage?: string;
  /** Roles that can initiate transitions FROM this step. */
  allowedRoles?: string[];
}

export interface WorkflowTransition {
  from: string;
  to: string;
  /** Human-readable label for this transition (e.g. "Submit for Verification"). */
  label?: string;
  /** Permission required to execute this transition. */
  permission?: string;
  /** If true, all actions on the entity must be completed before this transition. */
  requiresCompletedActions?: boolean;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  initialState: string;
  steps: WorkflowStep[];
  transitions: WorkflowTransition[];
  terminalStates: string[];
}

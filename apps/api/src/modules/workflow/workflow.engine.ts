import { Injectable } from '@nestjs/common';
import type { WorkflowDefinition, WorkflowTransition } from './workflow.types';

/**
 * Phase 7.7 — Generic workflow engine (pure functions, no DB persistence).
 * The CAPA table IS the workflow instance — this engine validates transitions
 * against a WorkflowDefinition and returns available next steps.
 *
 * Future consumers (Purchasing, Supplier Qualification) pass their own
 * WorkflowDefinition. The engine does not hardcode any business logic.
 */
@Injectable()
export class WorkflowEngine {
  /** Returns true if transitioning from → to is allowed by the definition. */
  canTransition(def: WorkflowDefinition, from: string, to: string): boolean {
    return def.transitions.some((t) => t.from === from && t.to === to);
  }

  /** Returns all transitions available from the given state. */
  availableTransitions(def: WorkflowDefinition, from: string): WorkflowTransition[] {
    return def.transitions.filter((t) => t.from === from);
  }

  /** Returns the target states reachable from the given state. */
  nextSteps(def: WorkflowDefinition, from: string): string[] {
    return def.transitions.filter((t) => t.from === from).map((t) => t.to);
  }

  /** Returns true if the state is terminal (no outgoing transitions). */
  isTerminal(def: WorkflowDefinition, state: string): boolean {
    return def.terminalStates.includes(state);
  }

  /** Returns the step definition for a state, if it exists. */
  getStep(def: WorkflowDefinition, state: string) {
    return def.steps.find((s) => s.key === state);
  }
}

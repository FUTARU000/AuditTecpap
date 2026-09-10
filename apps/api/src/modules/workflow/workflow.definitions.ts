/**
 * Phase 7.7 — CAPA Workflow Definition.
 * Derived from CAPA_TRANSITIONS in @tecpap/config. This is the first business
 * process using the generic WorkflowDefinition type. Future workflows (Purchasing,
 * Supplier Qualification) define their own definitions using the same shape.
 */
import { CAPA_TRANSITIONS, CAPA_STATUS_LABELS } from '@tecpap/config';
import type { WorkflowDefinition } from './workflow.types';

const capaSteps = Object.entries(CAPA_STATUS_LABELS).map(([key, label]) => ({
  key,
  label,
}));

const capaTransitions = Object.entries(CAPA_TRANSITIONS).flatMap(([from, targets]) =>
  targets.map((to) => ({ from, to })),
);

export const CAPA_WORKFLOW: WorkflowDefinition = {
  id: 'capa',
  name: 'CAPA — Corrective and Preventive Action',
  description: 'TECPAP CAPA workflow: finding → assigned → corrective action → evidence → verification → validated → closed',
  initialState: 'ASSIGNED',
  steps: capaSteps,
  transitions: capaTransitions,
  terminalStates: ['CLOSED', 'CANCELLED'],
};

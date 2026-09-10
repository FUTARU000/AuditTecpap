import { Module } from '@nestjs/common';
import { WorkflowEngine } from './workflow.engine';

/**
 * Phase 7.7 — Workflow module. Provides the generic WorkflowEngine.
 * No DB tables — the engine is pure and stateless. Definitions (like
 * CAPA_WORKFLOW) are imported directly by consuming modules.
 */
@Module({
  providers: [WorkflowEngine],
  exports: [WorkflowEngine],
})
export class WorkflowModule {}

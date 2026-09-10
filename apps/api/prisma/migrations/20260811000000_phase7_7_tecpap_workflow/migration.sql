-- Phase 7.7 — TECPAP Business Workflow Alignment
-- Additive enum values (non-breaking: existing CAPAs keep their old status).

-- ALTER TYPE: Add new CAPA statuses for the TECPAP workflow
ALTER TYPE "CapaStatus" ADD VALUE IF NOT EXISTS 'ASSIGNED';
ALTER TYPE "CapaStatus" ADD VALUE IF NOT EXISTS 'EVIDENCE_UPLOADED';
ALTER TYPE "CapaStatus" ADD VALUE IF NOT EXISTS 'RETURNED';
ALTER TYPE "CapaStatus" ADD VALUE IF NOT EXISTS 'VALIDATED';

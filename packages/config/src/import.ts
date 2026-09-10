/**
 * Phase 7 — Legacy QMS Import configuration.
 *
 * Pure data + heuristics for the classification engine, workbook-purpose
 * detection (Excel → Audit Template vs. controlled document), and relationship
 * inference. Kept in `@tecpap/config` so the web app can render the same labels
 * and the API can apply the same rules without duplication.
 */

/** File families handled by the import pipeline. */
export const IMPORT_FORMATS = ['word', 'excel', 'pdf', 'powerpoint'] as const;
export type ImportFormat = (typeof IMPORT_FORMATS)[number];

/** Extension → format resolution. Legacy Office formats map to their OOXML kin. */
export const EXTENSION_FORMAT: Readonly<Record<string, ImportFormat>> = {
  doc: 'word', docx: 'word',
  xls: 'excel', xlsx: 'excel',
  pdf: 'pdf',
  ppt: 'powerpoint', pptx: 'powerpoint',
};

/** Target enterprise entity an imported file can materialize as. */
export const IMPORT_TARGET_TYPES = ['CONTROLLED_DOCUMENT', 'AUDIT_TEMPLATE', 'BUSINESS_OBJECT'] as const;
export type ImportTargetType = (typeof IMPORT_TARGET_TYPES)[number];

/**
 * Workbook-purpose detection. The order matters: the first purpose whose
 * keywords match (against sheet names + header row + title) wins. Only
 * `AUDIT_CHECKLIST` is converted into an Audit Template; every other purpose
 * becomes a controlled document with the detected purpose recorded as metadata.
 */
export interface WorkbookPurposeRule {
  key: string;
  label: string;
  keywords: readonly string[];
  /** Suggested controlled-document category code (DOCUMENT_CATEGORIES). */
  category?: string;
}

export const WORKBOOK_PURPOSES: readonly WorkbookPurposeRule[] = [
  { key: 'AUDIT_CHECKLIST', label: 'Audit Checklist', keywords: ['audit checklist', 'audit', 'checklist', 'conformity', 'compliance check', 'verification'], category: 'CHECKLIST' },
  { key: 'INSPECTION_FORM', label: 'Inspection Form', keywords: ['inspection', 'inspect', 'control plan'], category: 'FORM' },
  { key: 'CALIBRATION_RECORD', label: 'Calibration Record', keywords: ['calibration', 'calibrate', 'gauge'], category: 'RECORD' },
  { key: 'TRAINING_MATRIX', label: 'Training Matrix', keywords: ['training', 'competence', 'skill matrix', 'qualification'], category: 'RECORD' },
  { key: 'RISK_MATRIX', label: 'Risk Matrix', keywords: ['risk matrix', 'risk register', 'risk assessment'], category: 'RECORD' },
  { key: 'KPI_TRACKER', label: 'KPI Tracker', keywords: ['kpi', 'indicator', 'performance tracker', 'dashboard'], category: 'REPORT' },
  { key: 'CAPA_REGISTER', label: 'CAPA Register', keywords: ['capa', 'corrective action', 'nonconformity', 'non-conformity'], category: 'RECORD' },
  { key: 'SUPPLIER_REGISTER', label: 'Supplier Register', keywords: ['supplier', 'vendor', 'approved supplier'], category: 'RECORD' },
  { key: 'EQUIPMENT_REGISTER', label: 'Equipment Register', keywords: ['equipment', 'machine', 'asset register'], category: 'RECORD' },
  { key: 'CUSTOMER_COMPLAINT_REGISTER', label: 'Customer Complaint Register', keywords: ['complaint', 'customer complaint'], category: 'RECORD' },
  { key: 'MANAGEMENT_REVIEW_REGISTER', label: 'Management Review Register', keywords: ['management review', 'review minutes'], category: 'REPORT' },
  { key: 'PRODUCTION_RECORD', label: 'Production Record', keywords: ['production record', 'batch record', 'production log', 'shift log'], category: 'RECORD' },
];

/** Folder / keyword → category code inference for documents. */
export const CATEGORY_INFERENCE: readonly { keywords: readonly string[]; category: string }[] = [
  { keywords: ['procedure'], category: 'PROCEDURE' },
  { keywords: ['work instruction', 'instruction', 'wi'], category: 'WORK_INSTRUCTION' },
  { keywords: ['specification', 'spec'], category: 'SPECIFICATION' },
  { keywords: ['process sheet', 'process map', 'turtle'], category: 'PROCESS_SHEET' },
  { keywords: ['flow', 'flowchart', 'diagram'], category: 'FLOW_DIAGRAM' },
  { keywords: ['form', 'template'], category: 'FORM' },
  { keywords: ['record', 'register', 'log'], category: 'RECORD' },
  { keywords: ['report', 'analysis'], category: 'REPORT' },
  { keywords: ['certificate', 'attestation', 'attestat'], category: 'CERTIFICATE' },
  { keywords: ['policy'], category: 'POLICY' },
  { keywords: ['checklist', 'audit'], category: 'CHECKLIST' },
];

/**
 * Folder / keyword → department code inference. Codes must match the six
 * seeded TECPAP departments (see DEPARTMENTS in constants.ts) — PROD, QUAL,
 * PUR, HR, LOG, HYG. There is no MAINT/FIN/COM/IT department in this
 * organization; a stale rule referencing an unseeded code would still bump
 * the classifier's confidence score while silently resolving to no
 * department, which is worse than not matching at all.
 */
export const DEPARTMENT_INFERENCE: readonly { keywords: readonly string[]; department: string }[] = [
  { keywords: ['production', 'prod', 'manufacturing', 'line'], department: 'PROD' },
  { keywords: ['quality', 'qual', 'qa', 'qc', 'laboratory', 'lab'], department: 'QUAL' },
  { keywords: ['purchasing', 'purchase', 'procurement', 'supplier'], department: 'PUR' },
  { keywords: ['human resources', 'hr', 'people', 'training'], department: 'HR' },
  { keywords: ['logistics', 'warehouse', 'distribution', 'stock'], department: 'LOG' },
  { keywords: ['hygiene', 'sanitation', 'sanitary', 'food safety'], department: 'HYG' },
];

/**
 * Document-code pattern — TECPAP conventions like PROC-014, WI-002, F-045,
 * FORM 12. Captures a normalized code (e.g. "PROC-014") plus the bare numeric
 * revision hint when present.
 */
export const DOCUMENT_CODE_REGEX = /\b([A-Z]{2,5})[\s\-_]?(\d{2,4})\b/;
/** Revision table row pattern, e.g. "Rev 5", "v2.1", "Version 03". */
export const REVISION_REGEX = /\b(?:rev(?:ision)?|v|version)[\s.:]*([0-9]+(?:\.[0-9]+)?)/i;

/**
 * Relationship inference rules. Applied after materialization: if the source
 * document's title/path contains a `from` keyword and a candidate target's
 * contains a `to` keyword, a relationship of `type` is suggested.
 */
export const RELATION_INFERENCE: readonly { from: readonly string[]; to: readonly string[]; type: string }[] = [
  { from: ['procedure', 'process'], to: ['checklist', 'form'], type: 'USES' },
  { from: ['instruction'], to: ['specification', 'spec'], type: 'REFERENCES' },
  { from: ['audit'], to: ['finding', 'nonconformity'], type: 'GENERATES' },
  { from: ['training'], to: ['record', 'matrix'], type: 'USES' },
];

/** Minimum confidence threshold (0–1) above which an item is auto-approved. */
export const IMPORT_AUTO_APPROVE_CONFIDENCE = 0.9;

/**
 * Quality Management System catalogs — seeded/used by the documents domain.
 * Categories are DB-driven (administrators can add more); these are the defaults.
 */

export interface DocumentCategorySeed {
  code: string;
  name: string;
  /** Lucide icon name used by the UI. */
  icon: string;
  /** Brand-consistent hex color. */
  color: string;
  description: string;
  sortOrder: number;
}

export const DOCUMENT_CATEGORIES: readonly DocumentCategorySeed[] = [
  { code: 'PROCESS_SHEET', name: 'Process Sheet', icon: 'Workflow', color: '#5B8A1E', description: 'Process map / turtle diagram', sortOrder: 1 },
  { code: 'PROCEDURE', name: 'Procedure', icon: 'FileText', color: '#4A3728', description: 'Standard operating procedure', sortOrder: 2 },
  { code: 'WORK_INSTRUCTION', name: 'Work Instruction', icon: 'ListChecks', color: '#A87C58', description: 'Step-by-step task instruction', sortOrder: 3 },
  { code: 'SPECIFICATION', name: 'Specification', icon: 'Ruler', color: '#1565C0', description: 'Technical specification', sortOrder: 4 },
  { code: 'FLOW_DIAGRAM', name: 'Flow Diagram', icon: 'GitBranch', color: '#6FA3C0', description: 'Process flow / diagram', sortOrder: 5 },
  { code: 'FORM', name: 'Form', icon: 'ClipboardList', color: '#8D6E63', description: 'Fillable form', sortOrder: 6 },
  { code: 'RECORD', name: 'Record', icon: 'Archive', color: '#546E7A', description: 'Completed record / evidence', sortOrder: 7 },
  { code: 'REPORT', name: 'Report', icon: 'FileBarChart', color: '#7A5638', description: 'Analysis / report', sortOrder: 8 },
  { code: 'CERTIFICATE', name: 'Certificate', icon: 'Award', color: '#2E7D32', description: 'Certificate / attestation', sortOrder: 9 },
  { code: 'POLICY', name: 'Policy', icon: 'ShieldCheck', color: '#3A2A1E', description: 'Company policy', sortOrder: 10 },
  { code: 'EXTERNAL', name: 'External Document', icon: 'Globe', color: '#948877', description: 'External / third-party document', sortOrder: 11 },
  { code: 'TEMPLATE', name: 'Template', icon: 'LayoutTemplate', color: '#B8860B', description: 'Reusable template', sortOrder: 12 },
];

/** Typed relationships between controlled documents. */
export const RELATION_TYPES = ['USES', 'GENERATES', 'REFERENCES', 'REPLACES', 'ATTACHMENT'] as const;
export type RelationType = (typeof RELATION_TYPES)[number];

export const RELATION_TYPE_LABELS: Record<RelationType, string> = {
  USES: 'Uses',
  GENERATES: 'Generates',
  REFERENCES: 'References',
  REPLACES: 'Replaces',
  ATTACHMENT: 'Attachment',
};

/** Confidentiality classifications. */
export const CONFIDENTIALITY_LEVELS = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'] as const;
export type ConfidentialityLevel = (typeof CONFIDENTIALITY_LEVELS)[number];

export const CONFIDENTIALITY_LABELS: Record<ConfidentialityLevel, string> = {
  PUBLIC: 'Public',
  INTERNAL: 'Internal',
  CONFIDENTIAL: 'Confidential',
  RESTRICTED: 'Restricted',
};

/** Allowed upload extensions → MIME types. Extend here to add formats. */
export const SUPPORTED_FILE_TYPES: Readonly<Record<string, string>> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  svg: 'image/svg+xml',
};

/** Maximum upload size (bytes) — 50 MiB. */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/** Days before expiration/review to flag a document as "expiring soon". */
export const DOCUMENT_EXPIRING_WINDOW_DAYS = 30;

/**
 * Phase 7 — Legacy QMS Import DTOs. Mirrors the Prisma enums as string unions so
 * the web app is fully typed without depending on @prisma/client.
 */

export type ImportSource = 'LOCAL' | 'GOOGLE_DRIVE' | 'UPLOAD';

export type ImportJobStatus =
  | 'PENDING'
  | 'SCANNING'
  | 'PARSING'
  | 'CLASSIFYING'
  | 'WAITING_REVIEW'
  | 'IMPORTING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type ImportItemType = 'CONTROLLED_DOCUMENT' | 'AUDIT_TEMPLATE' | 'BUSINESS_OBJECT';

export type ImportItemStatus =
  | 'PENDING'
  | 'PARSED'
  | 'CLASSIFIED'
  | 'DUPLICATE'
  | 'AWAITING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'IMPORTED'
  | 'FAILED'
  | 'SKIPPED';

export type ReviewDecision = 'APPROVE' | 'REJECT' | 'MERGE' | 'REPLACE_VERSION';

export type DuplicateStrategy = 'SKIP' | 'REPLACE_VERSION' | 'MERGE_METADATA' | 'KEEP_BOTH';

/** Classification result attached to every import item. */
export interface ImportClassification {
  departmentCode: string | null;
  departmentId: string | null;
  processCode: string | null;
  processId: string | null;
  categoryCode: string | null;
  categoryId: string | null;
  documentType: string | null;
  confidence: number;
  /** Human-readable list of signals that drove the classification. */
  signals: string[];
}

export interface ImportItemDto {
  id: string;
  jobId: string;
  originalPath: string;
  relativePath: string | null;
  fileName: string;
  extension: string;
  mimeType: string | null;
  sizeBytes: number;
  checksum: string | null;
  parentFolder: string | null;
  format: string;
  status: ImportItemStatus;
  detectedType: string | null;
  targetEntityType: ImportItemType | null;
  classification: ImportClassification | null;
  parsedMetadata: Record<string, unknown> | null;
  contentExcerpt: string | null;
  pageCount: number | null;
  tableCount: number | null;
  imageCount: number | null;
  ocrNeeded: boolean;
  warnings: string[] | null;
  error: string | null;
  duplicateOfId: string | null;
  duplicateStrategy: DuplicateStrategy | null;
  reviewDecision: ReviewDecision | null;
  reviewNote: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  fileKey: string | null;
  importedEntityId: string | null;
  importedEntityType: string | null;
  importedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ImportJobDto {
  id: string;
  source: ImportSource;
  sourceLocation: string | null;
  name: string | null;
  status: ImportJobStatus;
  startedById: string;
  startedByName: string | null;
  progress: number;
  processed: number;
  imported: number;
  skipped: number;
  failed: number;
  duplicates: number;
  warnings: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
}

export interface ImportJobDetailDto extends ImportJobDto {
  errors: Array<{ fileName: string; message: string }> | null;
  stats: ImportJobStats | null;
  items: ImportItemDto[];
}

export interface ImportJobStats {
  byDepartment: Record<string, number>;
  byCategory: Record<string, number>;
  byFormat: Record<string, number>;
  byStatus: Record<string, number>;
  averageProcessingMs: number | null;
  storageBytes: number;
}

/** Aggregated metrics for the Import Dashboard (across all jobs). */
export interface ImportDashboardStatsDto {
  runningJobs: number;
  completedJobs: number;
  failedJobs: number;
  importedFiles: number;
  pendingReview: number;
  duplicates: number;
  warnings: number;
  errors: number;
  averageProcessingMs: number | null;
  byDepartment: Record<string, number>;
  byCategory: Record<string, number>;
  byFormat: Record<string, number>;
  storageBytes: number;
}

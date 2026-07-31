import type { ConfidentialityLevel, DocumentStatus } from './enums';

/** File metadata of the current/active version. */
export interface DocumentFileSummary {
  versionId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  version: string;
  uploadedAt: string;
}

export interface DocumentDto {
  id: string;
  title: string;
  code: string;
  description: string | null;
  departmentId: string;
  departmentName: string | null;
  processId: string | null;
  processName: string | null;
  categoryId: string;
  categoryName: string | null;
  categoryColor: string | null;
  /** Active version label, e.g. "1.0". */
  version: string;
  revision: number;
  status: DocumentStatus;
  ownerId: string | null;
  ownerName: string | null;
  reviewerId: string | null;
  reviewerName: string | null;
  approverId: string | null;
  approverName: string | null;
  keywords: string[];
  confidentiality: ConfidentialityLevel;
  effectiveDate: string | null;
  reviewDate: string | null;
  expirationDate: string | null;
  createdById: string;
  updatedById: string | null;
  file: DocumentFileSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDocumentDto {
  title: string;
  code: string;
  description?: string | null;
  departmentId: string;
  processId?: string | null;
  categoryId: string;
  ownerId?: string | null;
  reviewerId?: string | null;
  approverId?: string | null;
  keywords?: string[];
  confidentiality?: ConfidentialityLevel;
  effectiveDate?: string | null;
  reviewDate?: string | null;
  expirationDate?: string | null;
}

export interface UpdateDocumentDto {
  title?: string;
  code?: string;
  description?: string | null;
  departmentId?: string;
  processId?: string | null;
  categoryId?: string;
  ownerId?: string | null;
  reviewerId?: string | null;
  approverId?: string | null;
  keywords?: string[];
  confidentiality?: ConfidentialityLevel;
  effectiveDate?: string | null;
  reviewDate?: string | null;
  expirationDate?: string | null;
}

/** Status transition payload. */
export interface DocumentStatusChangeDto {
  status: DocumentStatus;
  comment?: string;
}

/** Tree node used by the DB-driven Department → Process → Category → Documents navigation. */
export interface DocumentTreeNode {
  id: string;
  name: string;
  code: string | null;
  type: 'department' | 'process' | 'category';
  count: number;
  children?: DocumentTreeNode[];
}

/**
 * Phase 7.6 — Enterprise Document Experience DTOs.
 */

export interface DocumentCommentDto {
  id: string;
  documentId: string;
  versionId: string | null;
  parentId: string | null;
  authorId: string;
  authorName: string;
  body: string;
  mentions: string[];
  resolved: boolean;
  resolvedById: string | null;
  resolvedAt: string | null;
  editedAt: string | null;
  createdAt: string;
  updatedAt: string;
  replies: DocumentCommentDto[];
}

export interface DocumentAcknowledgementDto {
  id: string;
  documentId: string;
  versionId: string;
  userId: string;
  userName: string;
  departmentId: string | null;
  acknowledgedAt: string;
}

export interface AcknowledgementStatusDto {
  documentId: string;
  versionId: string;
  acknowledged: { userId: string; userName: string; acknowledgedAt: string }[];
  pending: { userId: string; userName: string }[];
}

export interface DocumentBookmarkDto {
  id: string;
  type: 'document' | 'version' | 'search' | 'collection';
  entityId: string;
  versionId: string | null;
  label: string;
  href: string;
  createdAt: string;
}

/** Structured preview returned by the viewer (non-PDF formats are parsed; PDF is served). */
export interface DocumentPreviewDto {
  documentId: string;
  versionId: string;
  format: 'pdf' | 'word' | 'excel' | 'powerpoint' | 'csv' | 'image' | 'legacy' | 'text' | 'other';
  title: string;
  fileUrl: string;
  content: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export interface DocumentCompareBlock {
  status: 'added' | 'removed' | 'unchanged' | 'modified';
  a?: string;
  b?: string;
}

export interface DocumentCompareResultDto {
  documentId: string;
  versionA: { id: string; version: string };
  versionB: { id: string; version: string };
  blocks: DocumentCompareBlock[];
  metadataDiff: { field: string; a: unknown; b: unknown }[];
  summary: { added: number; removed: number; modified: number };
}

export interface DocumentInsightsDto {
  mostViewed: { id: string; title: string; code: string; count: number }[];
  mostDownloaded: { id: string; title: string; code: string; count: number }[];
  mostCommented: { id: string; title: string; code: string; count: number }[];
  mostAcknowledged: { id: string; title: string; code: string; count: number }[];
  recentlyUpdated: { id: string; title: string; code: string; updatedAt: string }[];
  pendingReview: number;
  expiringSoon: number;
  averageReviewDays: number | null;
}

export interface DocumentHistoryEventDto {
  id: string;
  eventType: string;
  title: string;
  actorName: string | null;
  createdAt: string;
}

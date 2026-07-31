export interface AuditEvidenceDto {
  id: string;
  auditId: string | null;
  questionId: string | null;
  findingId: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  comment: string | null;
  uploadedById: string;
  uploadedByName: string | null;
  createdAt: string;
}

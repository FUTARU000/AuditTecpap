export interface DocumentVersionDto {
  id: string;
  documentId: string;
  version: string;
  revision: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string | null;
  comment: string | null;
  uploadedById: string;
  uploadedByName: string | null;
  approvedById: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface CreateVersionDto {
  version: string;
  comment?: string;
}

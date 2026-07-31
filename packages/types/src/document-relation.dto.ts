import type { RelationType } from '@tecpap/config';

export interface DocumentRelationDto {
  id: string;
  sourceDocumentId: string;
  targetDocumentId: string;
  type: RelationType;
  targetTitle: string;
  targetCode: string;
  targetStatus: string;
  createdAt: string;
}

export interface CreateRelationDto {
  targetDocumentId: string;
  type: RelationType;
}

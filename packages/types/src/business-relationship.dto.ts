export interface BusinessRelationshipDto {
  id: string;
  sourceType: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  type: string;
  label: string | null;
  createdAt: string;
}

export interface CreateRelationshipDto {
  targetType: string;
  targetId: string;
  type: string;
  label?: string | null;
}

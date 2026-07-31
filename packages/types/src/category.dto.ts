export interface DocumentCategoryDto {
  id: string;
  code: string;
  name: string;
  icon: string | null;
  color: string | null;
  description: string | null;
  active: boolean;
  sortOrder: number;
  documentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryDto {
  code: string;
  name: string;
  icon?: string | null;
  color?: string | null;
  description?: string | null;
  active?: boolean;
  sortOrder?: number;
}

export interface UpdateCategoryDto {
  name?: string;
  icon?: string | null;
  color?: string | null;
  description?: string | null;
  active?: boolean;
  sortOrder?: number;
}

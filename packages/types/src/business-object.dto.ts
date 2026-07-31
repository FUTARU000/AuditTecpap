export interface BusinessObjectTypeDto {
  id: string;
  code: string;
  name: string;
  icon: string | null;
  color: string | null;
  description: string | null;
  active: boolean;
  sortOrder: number;
  objectCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessObjectDto {
  id: string;
  typeId: string;
  typeName: string | null;
  departmentId: string;
  departmentName: string | null;
  processId: string | null;
  processName: string | null;
  name: string;
  code: string;
  status: string;
  attributes: Record<string, unknown> | null;
  ownerId: string | null;
  ownerName: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBusinessObjectDto {
  typeId: string;
  departmentId: string;
  processId?: string | null;
  name: string;
  code: string;
  status?: string;
  attributes?: Record<string, unknown>;
  ownerId?: string | null;
}

export interface UpdateBusinessObjectDto {
  name?: string;
  code?: string;
  status?: string;
  attributes?: Record<string, unknown>;
  ownerId?: string | null;
  processId?: string | null;
}

export interface ListBusinessObjectsQuery {
  page?: string;
  pageSize?: string;
  search?: string;
  sort?: string;
  typeId?: string;
  processId?: string;
  departmentId?: string;
  status?: string;
}

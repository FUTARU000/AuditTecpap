import type { DepartmentStatus } from './enums';

export interface DepartmentDto {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  status: DepartmentStatus;
  managerId: string | null;
  managerName: string | null;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDepartmentDto {
  code: string;
  name: string;
  description?: string | null;
  sortOrder?: number;
  status?: DepartmentStatus;
  managerId?: string | null;
}

export interface UpdateDepartmentDto {
  code?: string;
  name?: string;
  description?: string | null;
  sortOrder?: number;
  status?: DepartmentStatus;
  managerId?: string | null;
}

export interface DepartmentStatsDto {
  total: number;
  active: number;
  inactive: number;
  totalMembers: number;
  /** Per-department member counts. */
  byDepartment: Array<{ id: string; name: string; code: string; memberCount: number }>;
}

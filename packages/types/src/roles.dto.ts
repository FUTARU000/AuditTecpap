import type { PermissionDefinition } from '@tecpap/config';

export interface RoleDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isSystem: boolean;
  isGlobal: boolean;
  permissions: string[];
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoleDto {
  name: string;
  description?: string | null;
  isGlobal?: boolean;
  permissions: string[];
}

export interface UpdateRoleDto {
  name?: string;
  description?: string | null;
  isGlobal?: boolean;
  permissions?: string[];
}

export type PermissionCatalogItem = PermissionDefinition & { group: string };

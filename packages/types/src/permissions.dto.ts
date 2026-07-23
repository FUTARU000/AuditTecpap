import type { PermissionGroup } from '@tecpap/config';

export interface PermissionDto {
  id: string;
  key: string;
  group: string;
  label: string;
  description: string | null;
  createdAt: string;
}

export interface PermissionCatalogResponse {
  groups: PermissionGroup[];
  /** Total number of permission keys. */
  total: number;
}

import type { ProcessStatus } from './enums';

export interface ProcessDto {
  id: string;
  code: string;
  name: string;
  description: string | null;
  departmentId: string;
  departmentName: string | null;
  ownerId: string | null;
  ownerName: string | null;
  objectives: string | null;
  scope: string | null;
  risks: unknown;
  opportunities: unknown;
  kpis: unknown;
  status: ProcessStatus;
  revision: number;
  documentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProcessDto {
  code: string;
  name: string;
  description?: string | null;
  departmentId: string;
  ownerId?: string | null;
  objectives?: string | null;
  scope?: string | null;
  risks?: unknown;
  opportunities?: unknown;
  kpis?: unknown;
  status?: ProcessStatus;
}

export interface UpdateProcessDto {
  code?: string;
  name?: string;
  description?: string | null;
  departmentId?: string;
  ownerId?: string | null;
  objectives?: string | null;
  scope?: string | null;
  risks?: unknown;
  opportunities?: unknown;
  kpis?: unknown;
  status?: ProcessStatus;
}

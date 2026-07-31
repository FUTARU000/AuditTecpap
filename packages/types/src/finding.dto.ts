import type { FindingSeverity } from './enums';

export interface FindingDto {
  id: string;
  auditId: string;
  questionId: string | null;
  title: string;
  description: string | null;
  severity: FindingSeverity;
  responsibleUserId: string | null;
  responsibleName: string | null;
  dueDate: string | null;
  status: string;
  processId: string | null;
  comments: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFindingDto {
  auditId: string;
  questionId?: string | null;
  title: string;
  description?: string | null;
  severity: FindingSeverity;
  responsibleUserId?: string | null;
  dueDate?: string | null;
  processId?: string | null;
}

export interface UpdateFindingDto {
  title?: string;
  description?: string | null;
  severity?: FindingSeverity;
  responsibleUserId?: string | null;
  dueDate?: string | null;
  status?: string;
  comments?: string | null;
}

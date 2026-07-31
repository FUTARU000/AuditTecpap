import type { AuditStatus } from './enums';

export interface AuditAnswerDto {
  id: string;
  questionId: string;
  value: unknown;
  status: string;
  findingId: string | null;
  updatedAt: string;
}

export interface AuditDto {
  id: string;
  title: string;
  templateId: string;
  templateName: string | null;
  departmentId: string;
  departmentName: string | null;
  processId: string | null;
  processName: string | null;
  auditorId: string | null;
  auditorName: string | null;
  status: AuditStatus;
  scheduledDate: string | null;
  startedAt: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  approvedById: string | null;
  approvedByName: string | null;
  score: number | null;
  compliance: number | null;
  progress: number;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAuditDto {
  title: string;
  templateId: string;
  departmentId: string;
  processId?: string | null;
  auditorId?: string | null;
  scheduledDate?: string | null;
}

export interface AnswerQuestionDto {
  questionId: string;
  value: unknown;
  status?: string;
}

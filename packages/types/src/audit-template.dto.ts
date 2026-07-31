import type { QuestionType, TemplateStatus } from './enums';

export interface AuditTemplateQuestionDto {
  id: string;
  sectionId: string;
  text: string;
  type: QuestionType;
  required: boolean;
  weight: number;
  order: number;
  description: string | null;
  helpText: string | null;
  defaultAnswer: unknown;
  evidenceRequired: boolean;
  findingRequired: boolean;
  options: string[];
}

export interface AuditTemplateSectionDto {
  id: string;
  templateId: string;
  title: string;
  order: number;
  description: string | null;
  questions: AuditTemplateQuestionDto[];
}

export interface AuditTemplateDto {
  id: string;
  name: string;
  description: string | null;
  category: string;
  version: number;
  status: TemplateStatus;
  departmentId: string | null;
  departmentName: string | null;
  processId: string | null;
  processName: string | null;
  createdById: string;
  createdByName: string | null;
  sectionCount: number;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Full template with sections + questions (for the builder + execution). */
export interface AuditTemplateDetailDto extends AuditTemplateDto {
  sections: AuditTemplateSectionDto[];
}

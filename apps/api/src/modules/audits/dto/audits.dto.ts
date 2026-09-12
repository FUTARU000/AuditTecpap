import { IsEnum, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { AUDIT_STATUSES, type AuditStatus } from '@tecpap/config';

export class CreateAuditDto {
  @IsString() title!: string;
  @IsUUID() templateId!: string;
  @IsUUID() departmentId!: string;
  @IsOptional() @IsUUID() processId?: string;
  @IsOptional() @IsUUID() auditorId?: string;
  @IsOptional() @IsString() scheduledDate?: string;
}

export class AnswerQuestionDto {
  @IsUUID() questionId!: string;
  @IsObject() value!: Record<string, unknown>;
  @IsOptional() @IsString() status?: string; // ok | fail | na | pending
}

export class ReviewDto {
  @IsOptional() @IsString() comment?: string;
}

export class ListAuditsQuery {
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() pageSize?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() sort?: string;
  @IsOptional() @IsEnum(AUDIT_STATUSES) status?: AuditStatus;
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsUUID() processId?: string;
  @IsOptional() @IsUUID() auditorId?: string;
  @IsOptional() @IsUUID() templateId?: string;
  @IsOptional() @IsString() dateFrom?: string;
  @IsOptional() @IsString() dateTo?: string;
}

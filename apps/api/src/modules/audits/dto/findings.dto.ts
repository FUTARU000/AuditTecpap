import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { FINDING_SEVERITIES, type FindingSeverity } from '@tecpap/config';

export class CreateFindingDto {
  @IsOptional() @IsUUID() auditId?: string;
  @IsOptional() @IsUUID() questionId?: string;
  @IsString() title!: string;
  @IsOptional() @IsString() description?: string;
  @IsEnum(FINDING_SEVERITIES) severity!: FindingSeverity;
  @IsOptional() @IsUUID() responsibleUserId?: string;
  @IsOptional() @IsString() dueDate?: string;
  @IsOptional() @IsUUID() processId?: string;
}

export class UpdateFindingDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(FINDING_SEVERITIES) severity?: FindingSeverity;
  @IsOptional() @IsUUID() responsibleUserId?: string;
  @IsOptional() @IsString() dueDate?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() comments?: string;
}

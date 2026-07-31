import { IsArray, IsBoolean, IsEnum, IsNumber, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import { QUESTION_TYPES, TEMPLATE_CATEGORIES, TEMPLATE_STATUSES, type QuestionType, type TemplateStatus } from '@tecpap/config';

export class CreateQuestionDto {
  @IsString() text!: string;
  @IsEnum(QUESTION_TYPES) type!: QuestionType;
  @IsOptional() @IsBoolean() required?: boolean;
  @IsOptional() @IsNumber() weight?: number;
  @IsOptional() @IsNumber() order?: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() helpText?: string;
  @IsOptional() @IsObject() defaultAnswer?: Record<string, unknown>;
  @IsOptional() @IsBoolean() evidenceRequired?: boolean;
  @IsOptional() @IsBoolean() findingRequired?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) options?: string[];
}

export class CreateSectionDto {
  @IsString() title!: string;
  @IsOptional() @IsNumber() order?: number;
  @IsOptional() @IsString() description?: string;
  @IsArray() @IsObject({ each: true }) questions!: CreateQuestionDto[];
}

export class CreateTemplateDto {
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsString() category!: string;
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsUUID() processId?: string;
  @IsArray() @IsObject({ each: true }) sections!: CreateSectionDto[];
}

export class UpdateTemplateDto extends PartialType(CreateTemplateDto) {}

export class ListTemplatesQuery {
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() pageSize?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsEnum(TEMPLATE_STATUSES) status?: TemplateStatus;
  @IsOptional() @IsEnum(TEMPLATE_CATEGORIES) category?: string;
}

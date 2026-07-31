import { IsArray, IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import { CONFIDENTIALITY_LEVELS, RELATION_TYPES, type ConfidentialityLevel, type RelationType } from '@tecpap/config';
import { DOCUMENT_STATUS, type DocumentStatus } from '@tecpap/types';

export class CreateDocumentDto {
  @IsString() title!: string;
  @IsString() code!: string;
  @IsOptional() @IsString() description?: string;
  @IsUUID() departmentId!: string;
  @IsOptional() @IsUUID() processId?: string;
  @IsUUID() categoryId!: string;
  @IsOptional() @IsUUID() ownerId?: string;
  @IsOptional() @IsUUID() reviewerId?: string;
  @IsOptional() @IsUUID() approverId?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) keywords?: string[];
  @IsOptional() @IsEnum(CONFIDENTIALITY_LEVELS) confidentiality?: ConfidentialityLevel;
  @IsOptional() @IsDateString() effectiveDate?: string;
  @IsOptional() @IsDateString() reviewDate?: string;
  @IsOptional() @IsDateString() expirationDate?: string;
}

export class UpdateDocumentDto extends PartialType(CreateDocumentDto) {}

export class DocumentStatusChangeDto {
  @IsEnum(DOCUMENT_STATUS) status!: DocumentStatus;
  @IsOptional() @IsString() comment?: string;
}

export class ListDocumentsQuery {
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() pageSize?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() sort?: string;
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsUUID() processId?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsEnum(DOCUMENT_STATUS) status?: DocumentStatus;
  @IsOptional() @IsUUID() ownerId?: string;
}

export class CreateRelationDto {
  @IsUUID() targetDocumentId!: string;
  @IsEnum(RELATION_TYPES) type!: RelationType;
}

export class CreateVersionDto {
  @IsString() version!: string;
  @IsOptional() @IsString() comment?: string;
}

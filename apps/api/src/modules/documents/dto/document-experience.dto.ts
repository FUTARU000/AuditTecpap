import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateCommentDto {
  @IsString() @MaxLength(4000) body!: string;
  @IsOptional() @IsUUID() versionId?: string;
  @IsOptional() @IsUUID() parentId?: string;
}

export class UpdateCommentDto {
  @IsString() @MaxLength(4000) body!: string;
}

export class CreateBookmarkDto {
  @IsEnum(['document', 'version', 'search', 'collection']) type!: 'document' | 'version' | 'search' | 'collection';
  @IsString() @MaxLength(100) entityId!: string;
  @IsOptional() @IsUUID() versionId?: string;
  @IsString() @MaxLength(200) label!: string;
  @IsString() @MaxLength(300) href!: string;
}

export class CompareVersionsDto {
  @IsUUID() a!: string;
  @IsUUID() b!: string;
}

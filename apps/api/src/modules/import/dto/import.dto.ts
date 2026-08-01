import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import type { ReviewDecision } from '@tecpap/types';

export class StartImportDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  /** Folder path for LOCAL source scans. */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  sourceLocation?: string;
}

export class ScanImportDto {
  @IsString()
  @MaxLength(1000)
  sourceLocation!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;
}

/** Optional reviewer overrides applied on top of the inferred classification. */
export class ReviewOverridesDto {
  @IsOptional()
  @IsString()
  departmentCode?: string;

  @IsOptional()
  @IsString()
  categoryCode?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  code?: string;
}

export class ReviewItemDto {
  @IsEnum(['APPROVE', 'REJECT', 'MERGE', 'REPLACE_VERSION'])
  decision!: ReviewDecision;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsOptional()
  overrides?: ReviewOverridesDto;
}

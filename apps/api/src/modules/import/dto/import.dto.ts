import { IsEnum, IsIn, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import type { ReviewDecision } from '@tecpap/types';

/** Sources selectable via the /import/scan endpoint (UPLOAD has its own multipart endpoint). */
const SCAN_SOURCES = ['LOCAL', 'GOOGLE_DRIVE'] as const;
type ScanSource = (typeof SCAN_SOURCES)[number];

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

  /** JSON array of folder-relative paths (browser folder upload via webkitdirectory). */
  @IsOptional()
  @IsString()
  paths?: string;
}

export class ScanImportDto {
  /** Defaults to LOCAL when omitted, preserving prior behavior for existing callers. */
  @IsOptional()
  @IsIn(SCAN_SOURCES)
  source?: ScanSource;

  /**
   * Server-mounted folder path — required for LOCAL (never defaults to the
   * server's working directory). Optional for GOOGLE_DRIVE: when omitted,
   * the provider falls back to the server-configured GOOGLE_DRIVE_FOLDER_ID,
   * so the caller (and the frontend) never needs to know or pass the Drive
   * folder id.
   */
  @ValidateIf((o: ScanImportDto) => o.source !== 'GOOGLE_DRIVE')
  @IsString()
  @MaxLength(1000)
  sourceLocation?: string;

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

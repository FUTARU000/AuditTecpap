/**
 * Source providers abstract where files come from (a mounted folder today,
 * Google Drive tomorrow). The scanner consumes ScannedFile records; providers
 * only enumerate + read bytes. Adding a source = implement ImportSourceProvider.
 */

import type { ImportSource } from '@prisma/client';

/** A file discovered by a provider, before parsing/classification. */
export interface ScannedFile {
  /** Permanent original path (e.g. "Production/Procedures/PROC-014.docx"). */
  originalPath: string;
  relativePath: string;
  fileName: string;
  extension: string;
  mimeType: string;
  sizeBytes: number;
  parentFolder: string | null;
  modifiedAt?: Date;
  /** Lazily read the bytes (keeps large scans memory-efficient). */
  read(): Promise<Buffer>;
}

export interface ImportSourceProvider {
  readonly source: ImportSource;
  /** Human-readable id used in ImportJob.sourceLocation. */
  readonly key: string;
  canHandle(source: ImportSource): boolean;
  scan(location: string): Promise<ScannedFile[]>;
}

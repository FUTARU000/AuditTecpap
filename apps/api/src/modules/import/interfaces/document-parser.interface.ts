/**
 * Parser abstraction for the future bulk-import pipeline (thousands of files
 * currently in Google Drive). Parsers are pluggable: register one per format
 * and the ImportService resolves it automatically. No concrete parsers ship yet.
 */

export type ImportFormat = 'word' | 'excel' | 'powerpoint' | 'pdf' | 'csv' | 'zip';

export interface ImportFileInput {
  name: string;
  buffer: Buffer;
  mimeType: string;
  size: number;
}

/** Structured result of parsing a single file into a QMS document. */
export interface ParsedDocument {
  title: string;
  code?: string;
  description?: string;
  content?: string;
  metadata?: Record<string, unknown>;
}

export interface DocumentParser {
  readonly format: ImportFormat;
  readonly mimeTypes: readonly string[];
  canHandle(input: ImportFileInput): boolean;
  parse(input: ImportFileInput): Promise<ParsedDocument>;
}

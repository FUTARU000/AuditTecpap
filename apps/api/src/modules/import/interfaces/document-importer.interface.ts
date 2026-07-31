import type { ParsedDocument } from './document-parser.interface';

/** Orchestrates turning a raw file into a controlled document. */
export interface DocumentImporter {
  importFile(input: { name: string; buffer: Buffer; mimeType: string }): Promise<{
    documentId: string | null;
    parsed: ParsedDocument;
    warnings: string[];
  }>;
}

export type ImportJobStatus = 'queued' | 'running' | 'completed' | 'failed';

/** Background-job contract for asynchronous imports (large batches / ZIPs). */
export interface ImportJob {
  id: string;
  fileName: string;
  status: ImportJobStatus;
  createdAt: string;
  completedAt?: string;
  result?: { documentId?: string; warnings?: string[] };
  error?: string;
}

export interface ImportJobRunner {
  enqueue(input: { name: string; buffer: Buffer; mimeType: string }): Promise<ImportJob>;
  get(id: string): Promise<ImportJob | null>;
}

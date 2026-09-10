/**
 * Parser abstraction for the bulk-import pipeline. Parsers are pluggable:
 * register one per format and the orchestrator resolves it automatically.
 * Adding a future parser requires only implementing DocumentParser and
 * registering it in the module — no orchestrator changes.
 */

import type { ImportFormat } from '@tecpap/config';

export type { ImportFormat } from '@tecpap/config';

export interface ImportFileInput {
  name: string;
  /** Original drive-relative path (e.g. "Production/Procedures/PROC-014.docx"). */
  originalPath?: string;
  buffer: Buffer;
  mimeType: string;
  size: number;
}

/** A question extracted from a spreadsheet audit checklist. */
export interface ParsedTemplateQuestion {
  text: string;
  type?: string;
  required?: boolean;
  evidenceRequired?: boolean;
  findingRequired?: boolean;
  weight?: number;
}

/** A section of a spreadsheet audit checklist. */
export interface ParsedTemplateSection {
  title: string;
  questions: ParsedTemplateQuestion[];
}

/** Structured worksheet data for enterprise Excel rendering. */
export interface SheetData {
  name: string;
  rows: string[][];
  columnCount: number;
  rowCount: number;
}

/** A bullet/paragraph with its indentation level (0 = top, 1 = indented, etc.). */
export interface SlideBullet {
  text: string;
  level: number;
}

/** An image extracted from a PPTX slide. */
export interface SlideImage {
  filename: string;
  mimeType: string;
  dataUrl: string;
}

/** Structured slide data for enterprise PowerPoint rendering. */
export interface SlideData {
  index: number;
  title: string;
  subtitle?: string;
  bullets: SlideBullet[];
  notes: string;
  images: SlideImage[];
  omittedObjects: string[];
}

/** Structured result of parsing a single file into enterprise knowledge. */
export interface ParsedDocument {
  title: string;
  code?: string;
  revision?: string;
  author?: string;
  approver?: string;
  effectiveDate?: string;
  description?: string;
  /** Full extracted text — indexed/previewed; the original file is preserved separately. */
  content?: string;
  contentExcerpt?: string;
  metadata?: Record<string, unknown>;
  pageCount?: number;
  tableCount?: number;
  imageCount?: number;
  headings?: string[];
  keywords?: string[];
  /** True when a PDF yielded no machine-readable text and needs OCR. */
  ocrNeeded?: boolean;
  /** Detected Excel workbook purpose (e.g. AUDIT_CHECKLIST) — drives conversion. */
  workbookPurpose?: string;
  /** Sections/questions when the workbook is an audit checklist. */
  sections?: ParsedTemplateSection[];
  /** Mammoth HTML output for Word documents (enterprise rendering). */
  html?: string;
  /** Per-sheet structured data for Excel (enterprise grid rendering). */
  sheets?: SheetData[];
  /** Per-slide structured data for PowerPoint (enterprise slide rendering). */
  slides?: SlideData[];
}

export interface DocumentParser {
  readonly format: ImportFormat;
  readonly mimeTypes: readonly string[];
  canHandle(input: ImportFileInput): boolean;
  parse(input: ImportFileInput): Promise<ParsedDocument>;
}

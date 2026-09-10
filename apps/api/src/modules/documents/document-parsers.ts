import { EXTENSION_FORMAT } from '@tecpap/config';
import { WordParser } from '../import/parsers/word.parser';
import { ExcelParser } from '../import/parsers/excel.parser';
import { PdfParser } from '../import/parsers/pdf.parser';
import { PowerPointParser } from '../import/parsers/powerpoint.parser';
import type { ParsedDocument } from '../import/interfaces/document-parser.interface';

/**
 * Reuses the Phase 7 import parsers for in-browser preview / version comparison.
 * The parsers are stateless, so we resolve them directly here — avoiding any DI
 * dependency on ImportModule (which already imports DocumentsModule).
 */
const PARSERS = [new WordParser(), new ExcelParser(), new PdfParser(), new PowerPointParser()];

export async function parseDocumentFile(fileName: string, buffer: Buffer, mimeType: string): Promise<ParsedDocument | null> {
  const parser = PARSERS.find((p) => p.canHandle({ name: fileName, buffer, mimeType, size: buffer.length }));
  if (!parser) return null;
  return parser.parse({ name: fileName, buffer, mimeType, size: buffer.length });
}

export function documentFormat(fileName: string): string | undefined {
  const ext = (fileName.split('.').pop() ?? '').toLowerCase();
  return EXTENSION_FORMAT[ext];
}

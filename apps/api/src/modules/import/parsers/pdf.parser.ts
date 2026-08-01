import { Injectable } from '@nestjs/common';
import pdfParse from 'pdf-parse';
import type { DocumentParser, ImportFileInput, ParsedDocument } from '../interfaces/document-parser.interface';
import { excerpt, extractDocumentCode, extractKeywords, titleFromName } from './parsers.util';

/**
 * PDF parser — extracts machine-readable text, page count and document info.
 * A scanned/image PDF yields (near) no text and is flagged `ocrNeeded` so the
 * pipeline can route it to OCR (pluggable) rather than silently storing blanks.
 */
@Injectable()
export class PdfParser implements DocumentParser {
  readonly format = 'pdf' as const;
  readonly mimeTypes = ['application/pdf'];
  private static readonly MIN_TEXT_CHARS = 20;

  canHandle(input: ImportFileInput): boolean {
    return /\.pdf$/i.test(input.name);
  }

  async parse(input: ImportFileInput): Promise<ParsedDocument> {
    const data = await pdfParse(input.buffer);
    const text = (data.text ?? '').trim();
    const ocrNeeded = text.replace(/\s+/g, '').length < PdfParser.MIN_TEXT_CHARS;
    const info = (data.info ?? {}) as Record<string, string>;
    const titleStr = String(info.Title ?? '').trim();
    const code = extractDocumentCode(text) || (titleStr ? extractDocumentCode(titleStr) : undefined);

    return {
      title: titleStr || titleFromName(input.name),
      code,
      author: info.Author ? String(info.Author) : undefined,
      description: excerpt(text),
      content: text,
      contentExcerpt: excerpt(text),
      pageCount: data.numpages,
      ocrNeeded,
      keywords: extractKeywords(text),
      metadata: {
        source: 'pdf',
        producer: info.Producer ? String(info.Producer) : undefined,
        created: info.CreationDate ? String(info.CreationDate) : undefined,
      },
    };
  }
}

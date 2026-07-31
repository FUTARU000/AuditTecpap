import { Injectable } from '@nestjs/common';
import type { DocumentParser, ImportFileInput, ImportFormat } from './interfaces/document-parser.interface';

/**
 * Registry of document parsers. A future phase registers concrete parsers
 * (Word/Excel/PowerPoint/PDF/CSV/ZIP, and eventually AI extraction) here; the
 * ImportService resolves the right one per file with no further changes.
 */
@Injectable()
export class ParserRegistry {
  private readonly parsers: DocumentParser[] = [];

  register(parser: DocumentParser): void {
    this.parsers.push(parser);
  }

  all(): readonly DocumentParser[] {
    return this.parsers;
  }

  findByFile(input: ImportFileInput): DocumentParser | undefined {
    return this.parsers.find((parser) => parser.canHandle(input));
  }

  findByFormat(format: ImportFormat): DocumentParser | undefined {
    return this.parsers.find((parser) => parser.format === format);
  }
}

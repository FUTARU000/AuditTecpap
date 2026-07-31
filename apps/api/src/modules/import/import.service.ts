import { Injectable, NotImplementedException } from '@nestjs/common';
import type { ParsedDocument } from './interfaces/document-parser.interface';
import type { DocumentImporter } from './interfaces/document-importer.interface';
import { ParserRegistry } from './parser.registry';

/**
 * Import orchestrator. Resolves a parser for the file and would persist the
 * parsed document via DocumentsService. Concrete parsers + persistence are
 * intentionally deferred to the import phase — wiring them requires no redesign
 * here (just register parsers and call `create`).
 */
@Injectable()
export class ImportService implements DocumentImporter {
  constructor(private readonly registry: ParserRegistry) {}

  async importFile(input: { name: string; buffer: Buffer; mimeType: string }): Promise<{
    documentId: string | null;
    parsed: ParsedDocument;
    warnings: string[];
  }> {
    const parser = this.registry.findByFile({ ...input, size: input.buffer.length });
    if (!parser) {
      throw new NotImplementedException(
        `No parser registered for "${input.name}". Import parsers ship in a later phase.`,
      );
    }
    const parsed = await parser.parse({ ...input, size: input.buffer.length });
    // TODO(import phase): persist via DocumentsService.create(...) + upload the file as v1.
    return { documentId: null, parsed, warnings: [] };
  }
}

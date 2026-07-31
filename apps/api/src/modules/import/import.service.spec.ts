import { NotImplementedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { DocumentParser } from './interfaces/document-parser.interface';
import { ImportService } from './import.service';
import { ParserRegistry } from './parser.registry';

describe('ParserRegistry', () => {
  it('registers and resolves parsers by file and format', () => {
    const registry = new ParserRegistry();
    const parser: DocumentParser = {
      format: 'pdf',
      mimeTypes: ['application/pdf'],
      canHandle: (input) => input.name.endsWith('.pdf'),
      parse: vi.fn(),
    };
    registry.register(parser);
    expect(registry.findByFile({ name: 'a.pdf', buffer: Buffer.alloc(0), mimeType: 'application/pdf', size: 0 })).toBe(parser);
    expect(registry.findByFormat('pdf')).toBe(parser);
    expect(registry.findByFormat('word')).toBeUndefined();
  });
});

describe('ImportService', () => {
  it('throws NotImplemented when no parser is registered', async () => {
    const service = new ImportService(new ParserRegistry());
    await expect(service.importFile({ name: 'plan.docx', buffer: Buffer.alloc(0), mimeType: 'x' })).rejects.toBeInstanceOf(NotImplementedException);
  });

  it('delegates to the matching parser', async () => {
    const registry = new ParserRegistry();
    const parser: DocumentParser = {
      format: 'pdf',
      mimeTypes: ['application/pdf'],
      canHandle: (input) => input.name.endsWith('.pdf'),
      parse: vi.fn().mockResolvedValue({ title: 'Imported' }),
    };
    registry.register(parser);
    const result = await new ImportService(registry).importFile({ name: 'report.pdf', buffer: Buffer.from('data'), mimeType: 'application/pdf' });
    expect(result.parsed.title).toBe('Imported');
  });
});

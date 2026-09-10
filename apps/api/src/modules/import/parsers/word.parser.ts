import { Injectable, Logger } from '@nestjs/common';
import mammoth from 'mammoth';
import JSZip from 'jszip';
import type { DocumentParser, ImportFileInput, ParsedDocument } from '../interfaces/document-parser.interface';
import { excerpt, extractDocumentCode, extractKeywords, extractRevision, readOoxmlCoreProps, titleFromName } from './parsers.util';

/**
 * Word parser — extracts text, headings, tables, the document code/revision and
 * Dublin Core metadata (author/approver). Preserves the original file upstream.
 */
@Injectable()
export class WordParser implements DocumentParser {
  readonly format = 'word' as const;
  readonly mimeTypes = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
  ];
  private readonly logger = new Logger(WordParser.name);

  canHandle(input: ImportFileInput): boolean {
    return /\.(docx|doc)$/i.test(input.name);
  }

  async parse(input: ImportFileInput): Promise<ParsedDocument> {
    const core = await this.readCore(input.buffer);
    const text = await mammoth.extractRawText({ buffer: input.buffer }).then((r) => r.value).catch((e: unknown) => {
      this.logger.debug(`extractRawText failed for ${input.name}: ${String(e)}`);
      return '';
    });

    let tableCount = 0;
    let html = '';
    const headings: string[] = [];
    try {
      html = await mammoth.convertToHtml({ buffer: input.buffer }).then((r) => r.value);
      tableCount = (html.match(/<table/g) ?? []).length;
      for (const m of html.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/g)) {
        const h = (m[2] ?? '').replace(/<[^>]+>/g, '').trim();
        if (h) headings.push(h);
      }
    } catch {
      // Legacy .doc binaries cannot convert to HTML — text extraction still applies.
    }

    const haystack = `${headings.join('\n')}\n${text}`;
    const code = extractDocumentCode(haystack) ?? (core?.title ? extractDocumentCode(core.title) : undefined);
    const revision = extractRevision(text) ?? core?.revision;
    const title = core?.title || headings[0] || titleFromName(input.name);
    const keywords = extractKeywords(text);

    return {
      title,
      code,
      revision,
      author: core?.creator,
      approver: core?.lastModifiedBy,
      description: excerpt(text),
      content: text,
      contentExcerpt: excerpt(text),
      tableCount,
      headings,
      keywords,
      html: html || undefined,
      metadata: { source: 'word', coreProps: core ?? {}, modified: core?.modified, created: core?.created },
    };
  }

  private async readCore(buffer: Buffer) {
    try {
      const zip = await JSZip.loadAsync(buffer);
      const xml = zip.file('docProps/core.xml');
      return xml ? readOoxmlCoreProps(await xml.async('string')) : undefined;
    } catch {
      return undefined;
    }
  }
}

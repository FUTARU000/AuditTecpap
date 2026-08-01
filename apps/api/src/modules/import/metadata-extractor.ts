import { Injectable } from '@nestjs/common';
import type { ParsedDocument } from './interfaces/document-parser.interface';

const FR_HINTS = ['le', 'la', 'les', 'des', 'une', 'avec', 'pour', 'dans', 'que', 'qualité', 'procédure', 'conforme', 'vérification'];
const EN_HINTS = ['the', 'and', 'for', 'with', 'that', 'quality', 'procedure', 'compliance', 'verification', 'shall'];

const EFFECTIVE_DATE_RE = /(?:effective|applicable|date d['’]application|date d['’]effet)[^0-9]{0,12}(\d{4}-\d{2}-\d{2}|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/i;
const APPROVAL_DATE_RE = /(?:approved|approval|approbation|approuv[éeé]e?)[^0-9]{0,12}(\d{4}-\d{2}-\d{2}|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/i;

export interface ExtractedMetadata {
  language: 'fr' | 'en';
  effectiveDate: string | null;
  approvalDate: string | null;
  metadata: Record<string, unknown>;
}

/** Normalizes parser output into stable metadata (language, dates, counts, keywords). */
@Injectable()
export class MetadataExtractor {
  extract(parsed: ParsedDocument, contentFallback = ''): ExtractedMetadata {
    const text = `${parsed.title}\n${parsed.description ?? ''}\n${parsed.content ?? contentFallback}`;
    return {
      language: this.detectLanguage(text),
      effectiveDate: this.findDate(text, EFFECTIVE_DATE_RE),
      approvalDate: this.findDate(text, APPROVAL_DATE_RE),
      metadata: {
        ...(parsed.metadata ?? {}),
        title: parsed.title,
        code: parsed.code,
        revision: parsed.revision,
        author: parsed.author,
        approver: parsed.approver,
        pageCount: parsed.pageCount,
        tableCount: parsed.tableCount,
        imageCount: parsed.imageCount,
        headings: parsed.headings,
        keywords: parsed.keywords,
        workbookPurpose: parsed.workbookPurpose,
        // Sections are persisted so the review/materialization step can convert
        // an Excel audit checklist into an Audit Template without re-parsing.
        sections: parsed.sections,
      },
    };
  }

  detectLanguage(text: string): 'fr' | 'en' {
    const lower = ` ${text.toLowerCase()} `;
    const fr = FR_HINTS.reduce((n, w) => n + (lower.includes(` ${w} `) ? 1 : 0), 0);
    const en = EN_HINTS.reduce((n, w) => n + (lower.includes(` ${w} `) ? 1 : 0), 0);
    return fr > en ? 'fr' : 'en';
  }

  private findDate(text: string, re: RegExp): string | null {
    const m = text.match(re);
    return m?.[1] ?? null;
  }
}

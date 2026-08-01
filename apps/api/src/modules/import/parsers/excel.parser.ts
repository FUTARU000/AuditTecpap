import { Injectable, Logger } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { WORKBOOK_PURPOSES } from '@tecpap/config';
import type { DocumentParser, ImportFileInput, ParsedDocument, ParsedTemplateQuestion, ParsedTemplateSection } from '../interfaces/document-parser.interface';
import { excerpt, extractDocumentCode, extractKeywords, titleFromName } from './parsers.util';

const HEADER_QUESTION = /question|item|check|criteria|point|requirement|contrôl|exigence/i;
const HEADER_SECTION = /section|area|category|part|zone|domaine/i;
const HEADER_TYPE = /^type$/i;
const HEADER_REQUIRED = /require|mandatory|oblig/i;
const HEADER_EVIDENCE = /evidence|proof|attach|preuve/i;
const HEADER_WEIGHT = /weight|score|point|pond/i;

function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    // exceljs rich text / formula objects
    const v = value as { text?: string; result?: unknown; richText?: { text?: string }[] };
    if (typeof v.result !== 'undefined') return String(v.result);
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text ?? '').join('');
    if (v.text) return String(v.text);
  }
  return String(value).trim();
}

function mapQuestionType(raw: string): string {
  const t = raw.toLowerCase();
  if (/yes\s*\/\s*no\s*\/\s*n\/?a/.test(t)) return 'YES_NO_NA';
  if (/yes\s*\/\s*no/.test(t)) return 'YES_NO';
  if (/number|numeric|entier/.test(t)) return 'NUMBER';
  if (/date/.test(t)) return 'DATE';
  if (/short|court/.test(t)) return 'SHORT_TEXT';
  if (/long|paragraph|texte/.test(t)) return 'LONG_TEXT';
  if (/multiple|choix/.test(t)) return 'MULTIPLE_CHOICE';
  return 'YES_NO';
}

/**
 * Excel parser — detects the workbook purpose and, when it is an audit checklist,
 * converts it into structured sections/questions ready for AuditTemplatesService.
 */
@Injectable()
export class ExcelParser implements DocumentParser {
  readonly format = 'excel' as const;
  readonly mimeTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ];
  private readonly logger = new Logger(ExcelParser.name);

  canHandle(input: ImportFileInput): boolean {
    return /\.(xlsx|xls)$/i.test(input.name);
  }

  async parse(input: ImportFileInput): Promise<ParsedDocument> {
    const wb = new Workbook();
    await wb.xlsx.load(input.buffer as unknown as Parameters<Workbook['xlsx']['load']>[0]);

    const haystack: string[] = [];
    let imageCount = 0;
    const flat: string[] = [];

    for (const ws of wb.worksheets) {
      haystack.push(ws.name);
      imageCount += (ws as unknown as { getImages?: () => unknown[] }).getImages?.()?.length ?? 0;
      ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        const values = row.cellCount ? Array.from({ length: row.cellCount }, (_, i) => cellText(row.getCell(i + 1).value)) : [];
        if (rowNumber <= 2) haystack.push(...values);
        flat.push(values.join(' '));
      });
    }

    const text = flat.join('\n');
    const purpose = this.detectPurpose(haystack.join(' \n '));
    const sections = purpose === 'AUDIT_CHECKLIST' ? this.extractChecklist(wb) : undefined;
    const code = extractDocumentCode(text) ?? extractDocumentCode(wb.worksheets[0]?.name ?? '');
    const keywords = extractKeywords(text);
    const title = this.detectTitle(wb) || titleFromName(input.name);

    return {
      title,
      code,
      description: excerpt(text),
      content: text,
      contentExcerpt: excerpt(text),
      pageCount: wb.worksheets.length,
      tableCount: wb.worksheets.length,
      imageCount,
      keywords,
      workbookPurpose: purpose,
      sections,
      metadata: {
        source: 'excel',
        sheetNames: wb.worksheets.map((s) => s.name),
        rowCount: flat.length,
      },
    };
  }

  private detectPurpose(haystack: string): string | undefined {
    const h = haystack.toLowerCase();
    for (const rule of WORKBOOK_PURPOSES) {
      if (rule.keywords.some((k) => h.includes(k))) return rule.key;
    }
    return undefined;
  }

  private detectTitle(wb: Workbook): string | undefined {
    const a1 = cellText(wb.worksheets[0]?.getCell('A1').value);
    const looksLikeHeader = HEADER_QUESTION.test(a1) || HEADER_SECTION.test(a1) || HEADER_TYPE.test(a1) || HEADER_REQUIRED.test(a1) || HEADER_EVIDENCE.test(a1) || HEADER_WEIGHT.test(a1);
    return a1 && a1.length > 3 && !looksLikeHeader ? a1 : undefined;
  }

  /** Parse the first checklist-shaped worksheet into sections + questions. */
  private extractChecklist(wb: Workbook): ParsedTemplateSection[] {
    for (const ws of wb.worksheets) {
      const headerRow = ws.getRow(1);
      if (!headerRow || !headerRow.cellCount) continue;
      const cols = this.mapColumns(headerRow);
      if (cols.question === -1) continue;
      return this.readSections(ws, cols);
    }
    this.logger.debug('No checklist header detected; emitting a single placeholder section');
    return [];
  }

  private mapColumns(headerRow: import('exceljs').Row): { section: number; question: number; type: number; required: number; evidence: number; weight: number } {
    const cols = { section: -1, question: -1, type: -1, required: -1, evidence: -1, weight: -1 };
    for (let i = 1; i <= headerRow.cellCount; i++) {
      const h = cellText(headerRow.getCell(i).value).toLowerCase();
      if (!h) continue;
      if (cols.question === -1 && HEADER_QUESTION.test(h)) cols.question = i;
      else if (HEADER_SECTION.test(h)) cols.section = i;
      else if (HEADER_TYPE.test(h)) cols.type = i;
      else if (HEADER_REQUIRED.test(h)) cols.required = i;
      else if (HEADER_EVIDENCE.test(h)) cols.evidence = i;
      else if (HEADER_WEIGHT.test(h)) cols.weight = i;
    }
    return cols;
  }

  private readSections(ws: import('exceljs').Worksheet, cols: { section: number; question: number; type: number; required: number; evidence: number; weight: number }): ParsedTemplateSection[] {
    const sections = new Map<string, ParsedTemplateSection>();
    const fallback = ws.name || 'Checklist';
    let order = 0;
    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const q = cellText(row.getCell(cols.question).value).trim();
      if (!q) continue;
      const sectionName = cols.section > 0 ? cellText(row.getCell(cols.section).value).trim() || fallback : fallback;
      let section = sections.get(sectionName);
      if (!section) {
        section = { title: sectionName, questions: [] };
        sections.set(sectionName, section);
      }
      const question: ParsedTemplateQuestion = {
        text: q,
        type: cols.type > 0 ? mapQuestionType(cellText(row.getCell(cols.type).value)) : 'YES_NO',
        required: cols.required > 0 ? /^(y|yes|true|x|1|oui|o)/i.test(cellText(row.getCell(cols.required).value)) : false,
        evidenceRequired: cols.evidence > 0 ? /^(y|yes|true|x|1|oui|o)/i.test(cellText(row.getCell(cols.evidence).value)) : false,
        weight: cols.weight > 0 ? Number(cellText(row.getCell(cols.weight).value)) || 1 : 1,
      };
      section.questions.push(question);
      order++;
    }
    void order;
    return [...sections.values()];
  }
}

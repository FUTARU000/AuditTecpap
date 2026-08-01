import { Workbook } from 'exceljs';
import { describe, expect, it } from 'vitest';
import { ExcelParser } from './parsers/excel.parser';
import { extractDocumentCode, extractKeywords, extractRevision, readOoxmlCoreProps, titleFromName } from './parsers/parsers.util';

async function checklistBuffer(): Promise<Buffer> {
  const wb = new Workbook();
  const ws = wb.addWorksheet('Audit Checklist');
  ws.columns = [
    { header: 'Section', key: 'section' },
    { header: 'Question', key: 'question' },
    { header: 'Type', key: 'type' },
    { header: 'Required', key: 'required' },
    { header: 'Evidence', key: 'evidence' },
    { header: 'Weight', key: 'weight' },
  ];
  ws.addRow({ section: 'Line Clearance', question: 'Is the area clean?', type: 'Yes/No', required: 'Yes', evidence: 'No', weight: '2' });
  ws.addRow({ section: 'Line Clearance', question: 'Are records complete?', type: 'Yes/No/N/A', required: 'Yes', evidence: 'Yes', weight: '1' });
  ws.addRow({ section: 'Safety', question: 'Are guards in place?', type: 'Yes/No', required: 'Yes', evidence: 'No', weight: '2' });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe('ExcelParser — audit checklist conversion', () => {
  it('detects AUDIT_CHECKLIST and converts rows into sections + questions', async () => {
    const buffer = await checklistBuffer();
    const parser = new ExcelParser();
    const parsed = await parser.parse({ name: 'Production Audit Checklist.xlsx', buffer, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: buffer.length });

    expect(parsed.workbookPurpose).toBe('AUDIT_CHECKLIST');
    expect(parsed.sections).toHaveLength(2);
    const lc = parsed.sections!.find((s) => s.title === 'Line Clearance')!;
    expect(lc.questions).toHaveLength(2);
    expect(lc.questions[0]!.type).toBe('YES_NO');
    expect(lc.questions[0]!.required).toBe(true);
    expect(lc.questions[0]!.weight).toBe(2);
    const records = lc.questions.find((q) => q.text.includes('records'))!;
    expect(records.type).toBe('YES_NO_NA');
    expect(records.evidenceRequired).toBe(true);
  });

  it('does not convert a non-checklist workbook', async () => {
    const wb = new Workbook();
    const ws = wb.addWorksheet('Risk Matrix');
    ws.getCell('A1').value = 'Risk';
    ws.getCell('B1').value = 'Score';
    ws.addRow({ Risk: 'Contamination', Score: 9 });
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    const parsed = await new ExcelParser().parse({ name: 'risk.xlsx', buffer, mimeType: 'x', size: buffer.length });
    expect(parsed.workbookPurpose).toBe('RISK_MATRIX');
    expect(parsed.sections).toBeUndefined();
  });
});

describe('parsers.util', () => {
  it('extracts and normalizes document codes', () => {
    expect(extractDocumentCode('See PROC-014 for details')).toBe('PROC-014');
    expect(extractDocumentCode('WI 002')).toBe('WI-002');
    expect(extractDocumentCode('no code here')).toBeUndefined();
  });

  it('extracts revisions', () => {
    expect(extractRevision('Revision 5')).toBe('5');
    expect(extractRevision('v2.1')).toBe('2.1');
    expect(extractRevision('Version 03')).toBe('03');
  });

  it('derives a title from a filename', () => {
    expect(titleFromName('PROC-014_bottle_blowing.docx')).toBe('PROC 014 bottle blowing');
  });

  it('extracts frequency-based keywords', () => {
    const kw = extractKeywords('bottle blowing bottle blowing procedure quality line');
    expect(kw).toContain('bottle');
    expect(kw[0]).toBe('bottle');
  });

  it('reads Dublin Core properties from OOXML', () => {
    const xml = '<?xml version="1.0"?><cp:coreProperties xmlns:cp="cp" xmlns:dc="dc"><dc:title>Plan</dc:title><dc:creator>Audit Manager</dc:creator><cp:lastModifiedBy>Admin</cp:lastModifiedBy><cp:revision>3</cp:revision></cp:coreProperties>';
    const props = readOoxmlCoreProps(xml);
    expect(props.title).toBe('Plan');
    expect(props.creator).toBe('Audit Manager');
    expect(props.lastModifiedBy).toBe('Admin');
    expect(props.revision).toBe('3');
  });
});

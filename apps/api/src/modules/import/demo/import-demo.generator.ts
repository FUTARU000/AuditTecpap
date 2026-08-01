import { Injectable } from '@nestjs/common';
import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun } from 'docx';
import { Workbook } from 'exceljs';
import JSZip from 'jszip';
import PDFDocument from 'pdfkit';
import type { UploadFile } from '../import-job.service';

/**
 * Generates a realistic miniature of the company's Google Drive repository — one
 * file per supported format — entirely in memory, so the full import pipeline
 * (scan → parse → classify → review → materialize) can be demonstrated live with
 * no external dependencies. Each file carries the signals the parsers look for
 * (document codes, headings, checklist columns, slide text, OCR-free PDF text).
 */
@Injectable()
export class ImportDemoGenerator {
  async generate(department = 'PROD'): Promise<UploadFile[]> {
    return [
      await this.wordFile(department),
      await this.excelChecklist(department),
      await this.pdfFile(department),
      await this.powerpointFile(department),
    ];
  }

  private async wordFile(department: string): Promise<UploadFile> {
    const doc = new Document({
      creator: 'Quality Manager',
      title: 'Bottle Blowing Procedure',
      description: 'Standard operating procedure for PET bottle blowing',
      sections: [{
        children: [
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Bottle Blowing Procedure')] }),
          new Paragraph({ children: [new TextRun({ text: 'Document code: PROC-014     Revision: 5     Effective: 2024-01-15', bold: true })] }),
          new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('1. Purpose')] }),
          new Paragraph('This procedure defines the standardized operation of the blow molding lines to guarantee consistent bottle weight and quality.'),
          new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('2. Preheating')] }),
          new Paragraph('Preforms must be loaded into the oven and heated to the target temperature before molding. Verify the oven temperature every shift.'),
          new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('3. Revision history')] }),
          new Table({
            rows: [
              this.row('Rev', 'Date', 'Author'),
              this.row('5', '2024-01-15', 'Quality Manager'),
              this.row('4', '2023-06-01', 'Production Manager'),
            ],
          }),
        ],
      }],
    });
    const buffer = Buffer.from(await Packer.toBuffer(doc));
    return { name: 'PROC-014 Bottle Blowing Procedure.docx', buffer, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', originalPath: `${this.deptName(department)}/Procedures/PROC-014 Bottle Blowing Procedure.docx` };
  }

  private row(...cells: string[]): TableRow {
    return new TableRow({ children: cells.map((c) => new TableCell({ children: [new Paragraph(c)] })) });
  }

  private async excelChecklist(department: string): Promise<UploadFile> {
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
    const rows = [
      { section: 'Line Clearance', question: 'Is the production area clean and organized?', type: 'Yes/No', required: 'Yes', evidence: 'No', weight: '1' },
      { section: 'Line Clearance', question: 'Are batch records present and complete?', type: 'Yes/No/N/A', required: 'Yes', evidence: 'Yes', weight: '2' },
      { section: 'Line Clearance', question: 'Are previous batch materials removed?', type: 'Yes/No', required: 'No', evidence: 'No', weight: '1' },
      { section: 'Equipment & Safety', question: 'Is equipment calibration current?', type: 'Yes/No', required: 'Yes', evidence: 'Yes', weight: '2' },
      { section: 'Equipment & Safety', question: 'Are safety guards in place?', type: 'Yes/No', required: 'Yes', evidence: 'No', weight: '2' },
      { section: 'Equipment & Safety', question: 'Any visible leaks or defects?', type: 'Yes/No', required: 'No', evidence: 'Yes', weight: '1' },
    ];
    rows.forEach((r) => ws.addRow(r));
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    return { name: 'Production Audit Checklist.xlsx', buffer, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', originalPath: `${this.deptName(department)}/Checklists/Production Audit Checklist.xlsx` };
  }

  private async pdfFile(department: string): Promise<UploadFile> {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<void>((resolve) => doc.on('end', () => resolve()));
    doc.fontSize(20).font('Helvetica-Bold').text('Maintenance Specification SPEC-007', { align: 'center' });
    doc.moveDown();
    doc.fontSize(11).font('Helvetica').fillColor('black');
    doc.text('Preventive maintenance specification for the capping line. The torque wrench calibration interval is verified every 90 days. Lubrication of the conveyor bearings follows a weekly schedule. Any deviation from the torque range must be recorded and escalated to the maintenance supervisor.');
    doc.moveDown();
    doc.text('Keywords: torque, calibration, conveyor, lubrication, preventive maintenance, capping line.');
    doc.end();
    await done;
    const buffer = Buffer.concat(chunks);
    return { name: 'SPEC-007 Capping Line Maintenance.pdf', buffer, mimeType: 'application/pdf', originalPath: `${this.deptName(department)}/Specifications/SPEC-007 Capping Line Maintenance.pdf` };
  }

  private async powerpointFile(department: string): Promise<UploadFile> {
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide.main+xml"/><Override PartName="/ppt/slides/slide2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide.main+xml"/></Types>');
    zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>');
    zip.file('ppt/presentation.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldIdLst><p:sldId id="1" r:id="rId1"/><p:sldId id="2" r:id="rId2"/></p:sldIdLst></p:presentation>');
    zip.file('ppt/_rels/presentation.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/></Relationships>');
    zip.file('ppt/slides/slide1.xml', this.slide('Quality Objectives 2026', ['Reduce customer complaints by twenty percent', 'Achieve ninety eight percent first pass yield', 'Zero critical non conformities on the capping line']));
    zip.file('ppt/slides/slide2.xml', this.slide('Training Plan', ['All operators trained on the bottle blowing procedure', 'Refresher training scheduled each quarter', 'Competence evaluated by the shift supervisor']));
    zip.file('ppt/notesSlides/notesSlide1.xml', this.slide('Notes', ['Emphasize the link between torque calibration and complaint reduction']));
    zip.file('docProps/core.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Quality Management Review 2026</dc:title><dc:creator>Quality Manager</dc:creator><cp:lastModifiedBy>Quality Manager</cp:lastModifiedBy></cp:coreProperties>');
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    return { name: 'Quality Management Review 2026.pptx', buffer, mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', originalPath: `${this.deptName(department)}/Reports/Quality Management Review 2026.pptx` };
  }

  private slide(title: string, bullets: string[]): string {
    const paras = [`<a:p><a:r><a:t>${title}</a:t></a:r></a:p>`, ...bullets.map((b) => `<a:p><a:r><a:t>${b}</a:t></a:r></a:p>`)].join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="2" name="Content"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr/></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>${paras}</p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;
  }

  private deptName(code: string): string {
    const map: Record<string, string> = { PROD: 'Production', QUAL: 'Quality', MAINT: 'Maintenance' };
    return map[code] ?? 'Production';
  }
}

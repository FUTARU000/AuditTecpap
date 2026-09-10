import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEPARTMENT_INFERENCE } from '@tecpap/config';
import type { PrismaService } from '../prisma/prisma.service';
import { ClassificationEngine } from './classification.engine';
import type { ParsedDocument } from './interfaces/document-parser.interface';

const DEPARTMENTS = [
  { id: 'd-prod', code: 'PROD', name: 'Production' },
  { id: 'd-qual', code: 'QUAL', name: 'Quality' },
  { id: 'd-pur', code: 'PUR', name: 'Purchasing' },
  { id: 'd-hr', code: 'HR', name: 'Human Resources' },
  { id: 'd-log', code: 'LOG', name: 'Logistics' },
  { id: 'd-hyg', code: 'HYG', name: 'Hygiene' },
];
const CATEGORIES = [{ id: 'c-proc', code: 'PROCEDURE', name: 'Procedure' }];

function bareParsed(title: string): ParsedDocument {
  return { title };
}

describe('ClassificationEngine — department inference (real six TECPAP departments)', () => {
  let engine: ClassificationEngine;
  let prisma: { department: { findMany: ReturnType<typeof vi.fn> }; documentCategory: { findMany: ReturnType<typeof vi.fn> }; process: { findMany: ReturnType<typeof vi.fn> } };

  beforeEach(() => {
    prisma = {
      department: { findMany: vi.fn().mockResolvedValue(DEPARTMENTS) },
      documentCategory: { findMany: vi.fn().mockResolvedValue(CATEGORIES) },
      process: { findMany: vi.fn().mockResolvedValue([]) },
    };
    engine = new ClassificationEngine(prisma as unknown as PrismaService);
  });

  it('17a. infers Production from a path keyword', async () => {
    const cls = await engine.classify(bareParsed('Line procedure'), { path: 'Production/Procedures/PROC-014.docx', fileName: 'PROC-014.docx', format: 'word' });
    expect(cls.departmentCode).toBe('PROD');
    expect(cls.departmentId).toBe('d-prod');
  });

  it('17b. infers Quality from a path keyword', async () => {
    const cls = await engine.classify(bareParsed('QA checklist'), { path: 'Quality/QA/checklist.xlsx', fileName: 'checklist.xlsx', format: 'excel' });
    expect(cls.departmentCode).toBe('QUAL');
    expect(cls.departmentId).toBe('d-qual');
  });

  it('17c. infers Purchasing from a path keyword', async () => {
    const cls = await engine.classify(bareParsed('Supplier approval'), { path: 'Purchasing/Suppliers/approval.pdf', fileName: 'approval.pdf', format: 'pdf' });
    expect(cls.departmentCode).toBe('PUR');
    expect(cls.departmentId).toBe('d-pur');
  });

  it('17d. infers Human Resources from a path keyword', async () => {
    const cls = await engine.classify(bareParsed('Onboarding'), { path: 'Human Resources/Onboarding/checklist.docx', fileName: 'checklist.docx', format: 'word' });
    expect(cls.departmentCode).toBe('HR');
    expect(cls.departmentId).toBe('d-hr');
  });

  it('17e. infers Logistics from a path keyword', async () => {
    const cls = await engine.classify(bareParsed('Warehouse layout'), { path: 'Logistics/Warehouse/layout.pdf', fileName: 'layout.pdf', format: 'pdf' });
    expect(cls.departmentCode).toBe('LOG');
    expect(cls.departmentId).toBe('d-log');
  });

  it('17f./19. infers Hygiene from a path keyword', async () => {
    const cls = await engine.classify(bareParsed('Sanitation procedure'), { path: 'Hygiene/Sanitation/procedure.docx', fileName: 'procedure.docx', format: 'word' });
    expect(cls.departmentCode).toBe('HYG');
    expect(cls.departmentId).toBe('d-hyg');
  });

  it('19b. also infers Hygiene from a "food safety" keyword', async () => {
    const cls = await engine.classify(bareParsed('Food safety plan'), { path: 'QMS/Food Safety Plan.pdf', fileName: 'Food Safety Plan.pdf', format: 'pdf' });
    expect(cls.departmentCode).toBe('HYG');
    expect(cls.departmentId).toBe('d-hyg');
  });

  it('18a. the stale MAINT/FIN/COM/IT department codes no longer exist in the inference table', () => {
    const staleCodes = ['MAINT', 'FIN', 'COM', 'IT'];
    const presentCodes = DEPARTMENT_INFERENCE.map((rule) => rule.department);
    for (const stale of staleCodes) expect(presentCodes).not.toContain(stale);
  });

  it('18b. every remaining inference code resolves to one of the six real seeded departments', () => {
    const realCodes = new Set(DEPARTMENTS.map((d) => d.code));
    for (const rule of DEPARTMENT_INFERENCE) expect(realCodes.has(rule.department)).toBe(true);
  });

  it('18c. a path containing the old stale keywords ("maintenance", "finance", "IT") no longer resolves to any department', async () => {
    const cls = await engine.classify(bareParsed('Server maintenance log'), { path: 'IT/Maintenance/server-log.pdf', fileName: 'server-log.pdf', format: 'pdf' });
    expect(cls.departmentCode).toBeNull();
    expect(cls.departmentId).toBeNull();
  });

  it('an unrecognized path infers no department (reviewer must classify manually)', async () => {
    const cls = await engine.classify(bareParsed('Random notes'), { path: 'Misc/notes.pdf', fileName: 'notes.pdf', format: 'pdf' });
    expect(cls.departmentCode).toBeNull();
    expect(cls.departmentId).toBeNull();
  });
});

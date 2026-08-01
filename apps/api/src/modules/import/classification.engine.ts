import { Injectable } from '@nestjs/common';
import type { ImportClassification } from '@tecpap/types';
import {
  CATEGORY_INFERENCE,
  DEPARTMENT_INFERENCE,
  IMPORT_AUTO_APPROVE_CONFIDENCE,
  WORKBOOK_PURPOSES,
  type ImportFormat,
} from '@tecpap/config';
import { PrismaService } from '../prisma/prisma.service';
import type { ParsedDocument } from './interfaces/document-parser.interface';

interface ResolveMaps {
  departments: Map<string, { id: string; name: string }>; // by upper code
  categories: Map<string, { id: string; name: string }>; // by upper code
}

/**
 * Infers department / process / category / document type from the file path and
 * parsed content, resolved against the DB (codes → ids). Confidence reflects how
 * many independent signals agree, so reviewers can prioritize low-confidence rows.
 */
@Injectable()
export class ClassificationEngine {
  private cache: ResolveMaps | null = null;
  private cacheAt = 0;
  private static readonly TTL_MS = 60_000;

  constructor(private readonly prisma: PrismaService) {}

  /** Threshold used by the orchestrator to auto-approve without human review. */
  get autoApproveThreshold(): number {
    return IMPORT_AUTO_APPROVE_CONFIDENCE;
  }

  private async maps(): Promise<ResolveMaps> {
    const now = Date.now();
    if (this.cache && now - this.cacheAt < ClassificationEngine.TTL_MS) return this.cache;
    const [departments, categories] = await Promise.all([
      this.prisma.department.findMany({ select: { id: true, code: true, name: true } }),
      this.prisma.documentCategory.findMany({ select: { id: true, code: true, name: true } }),
    ]);
    this.cache = {
      departments: new Map(departments.map((d) => [d.code.toUpperCase(), { id: d.id, name: d.name }])),
      categories: new Map(categories.map((c) => [c.code.toUpperCase(), { id: c.id, name: c.name }])),
    };
    this.cacheAt = now;
    return this.cache;
  }

  async classify(parsed: ParsedDocument, ctx: { path: string; fileName: string; format: ImportFormat }): Promise<ImportClassification> {
    const maps = await this.maps();
    const haystack = `${ctx.path} ${ctx.fileName} ${parsed.title} ${parsed.description ?? ''} ${parsed.headings?.join(' ') ?? ''}`.toLowerCase();
    const signals: string[] = [];
    let confidence = 0.35;

    // ---- Department ----
    let departmentCode: string | null = null;
    const deptHit = DEPARTMENT_INFERENCE.find((d) => d.keywords.some((k) => haystack.includes(k)));
    if (deptHit) {
      departmentCode = deptHit.department;
      confidence += 0.25;
      signals.push(`department keyword "${deptHit.keywords.find((k) => haystack.includes(k))}"`);
    }
    const department = departmentCode ? maps.departments.get(departmentCode) : undefined;

    // ---- Process (best-effort: a process whose name appears in the path, within the dept) ----
    let processId: string | null = null;
    let processCode: string | null = null;
    if (department) {
      const candidates = await this.prisma.process.findMany({
        where: { departmentId: department.id, deletedAt: null },
        select: { id: true, code: true, name: true },
      });
      const hit = candidates.find((p) => haystack.includes(p.name.toLowerCase()) || haystack.includes(p.code.toLowerCase()));
      if (hit) {
        processId = hit.id;
        processCode = hit.code;
        confidence += 0.1;
        signals.push(`process "${hit.name}"`);
      }
    }

    // ---- Category ----
    let categoryCode: string | null = null;
    if (parsed.workbookPurpose) {
      const rule = WORKBOOK_PURPOSES.find((w) => w.key === parsed.workbookPurpose);
      if (rule?.category) categoryCode = rule.category;
    }
    if (!categoryCode) {
      const catHit = CATEGORY_INFERENCE.find((c) => c.keywords.some((k) => haystack.includes(k)));
      if (catHit) categoryCode = catHit.category;
    }
    const category = categoryCode ? maps.categories.get(categoryCode) : undefined;
    if (category) {
      confidence += 0.2;
      signals.push(`category "${category.name}"`);
    } else {
      categoryCode = null; // unknown code — don't store an unresolved code
    }

    // ---- Document type ----
    const documentType = parsed.workbookPurpose
      ? WORKBOOK_PURPOSES.find((w) => w.key === parsed.workbookPurpose)?.label ?? parsed.workbookPurpose
      : ctx.format === 'word'
        ? 'Procedure / Document'
        : ctx.format === 'pdf'
          ? 'Document'
          : ctx.format === 'powerpoint'
            ? 'Presentation'
            : 'Document';

    if (parsed.code) {
      confidence += 0.1;
      signals.push(`document code ${parsed.code}`);
    }
    if (parsed.workbookPurpose) {
      confidence += 0.05;
      signals.push(`workbook purpose ${parsed.workbookPurpose}`);
    }

    confidence = Math.min(0.99, Math.round(confidence * 100) / 100);
    if (confidence >= this.autoApproveThreshold) signals.push('high confidence');

    return {
      departmentCode,
      departmentId: department?.id ?? null,
      processCode,
      processId,
      categoryCode,
      categoryId: category?.id ?? null,
      documentType: documentType ?? null,
      confidence,
      signals,
    };
  }

  /** Resolve a category id by code (used when reviewers override the category). */
  async resolveCategoryId(code: string): Promise<string | null> {
    const maps = await this.maps();
    return maps.categories.get(code.toUpperCase())?.id ?? null;
  }

  async resolveDepartmentId(code: string): Promise<string | null> {
    const maps = await this.maps();
    return maps.departments.get(code.toUpperCase())?.id ?? null;
  }
}

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { GlobalSearchResultDto } from '@tecpap/types';
import {
  AUDIT_ACTIONS,
  type DocumentDto,
  type DocumentStatus,
  type DocumentTreeNode,
  type PaginatedResult,
} from '@tecpap/types';
import type { Prisma } from '@prisma/client';
import type { ActorContext } from '../../common/context/actor';
import { DOC_INCLUDE, toDocumentDto } from './document.mapper';
import { paginated, parsePagination, parseSort } from '../../common/pagination/pagination';
import { departmentScopeWhere } from '../../common/scoping/scope';
import type { DataScope } from '../../common/types/data-scope';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateDocumentDto, ListDocumentsQuery, UpdateDocumentDto } from './dto/documents.dto';

/** Allowed status transitions (ARCHIVED is reserved for soft-deleted documents). */
const TRANSITIONS: Record<DocumentStatus, DocumentStatus[]> = {
  DRAFT: ['UNDER_REVIEW', 'APPROVED', 'PUBLISHED', 'OBSOLETE'],
  UNDER_REVIEW: ['APPROVED', 'DRAFT', 'OBSOLETE'],
  APPROVED: ['PUBLISHED', 'OBSOLETE'],
  PUBLISHED: ['OBSOLETE', 'UNDER_REVIEW'],
  OBSOLETE: ['DRAFT'],
  ARCHIVED: ['DRAFT'],
};

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(query: ListDocumentsQuery, scope: DataScope | undefined): Promise<PaginatedResult<DocumentDto>> {
    const { skip, take, page, pageSize, sort, search } = parsePagination(query);
    const base: Prisma.ControlledDocumentWhereInput = {
      deletedAt: null,
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.processId ? { processId: query.processId } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.ownerId ? { ownerId: query.ownerId } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
              { keywords: { has: search } },
            ],
          }
        : {}),
    };

    const where = departmentScopeWhere(scope, base) as Prisma.ControlledDocumentWhereInput;
    const [rows, total] = await Promise.all([
      this.prisma.controlledDocument.findMany({
        where,
        skip,
        take,
        orderBy: parseSort(sort, ['title', 'code', 'status', 'createdAt', 'updatedAt'], { updatedAt: 'desc' }),
        include: DOC_INCLUDE,
      }),
      this.prisma.controlledDocument.count({ where }),
    ]);

    return paginated(rows.map((row) => toDocumentDto(row)), total, page, pageSize);
  }

  /** PostgreSQL full-text search over title/code/description/keywords. */
  async search(term: string, scope: DataScope | undefined): Promise<GlobalSearchResultDto[]> {
    const q = term.trim();
    if (q.length < 2) {
      return [];
    }

    const scoped = !!scope && !scope.isGlobal;
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        id: string;
        title: string;
        code: string;
        status: string;
        department_name: string | null;
        category_name: string | null;
        snippet: string | null;
      }>
    >(
      `SELECT d.id, d.title, d.code, d.status::text AS status,
              dep.name AS department_name, cat.name AS category_name,
              ts_headline('english', coalesce(d.description, ''), websearch_to_tsquery('english', $1), 'MaxWords=20') AS snippet
         FROM controlled_documents d
         LEFT JOIN departments dep ON dep.id = d."departmentId"
         LEFT JOIN document_categories cat ON cat.id = d."categoryId"
        WHERE d."deletedAt" IS NULL
          AND d."searchVector" @@ websearch_to_tsquery('english', $1)
          ${scoped ? 'AND d."departmentId" = $2' : ''}
        ORDER BY ts_rank(d."searchVector", websearch_to_tsquery('english', $1)) DESC
        LIMIT 50`,
      ...(scoped ? [q, scope?.departmentId ?? ''] : [q]),
    );

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      code: row.code,
      status: row.status,
      departmentName: row.department_name,
      categoryName: row.category_name,
      snippet: row.snippet,
    }));
  }

  /** Dynamic Department → Process → Category tree with document counts. */
  async tree(scope: DataScope | undefined): Promise<DocumentTreeNode[]> {
    const where = { deletedAt: null, ...departmentScopeWhere(scope) } as Prisma.ControlledDocumentWhereInput;
    const combos = await this.prisma.controlledDocument.groupBy({
      by: ['departmentId', 'processId', 'categoryId'],
      where,
      _count: { _all: true },
    });

    const [departments, processes, categories] = await Promise.all([
      this.prisma.department.findMany({
        where: departmentScopeWhere(scope) as Prisma.DepartmentWhereInput,
        orderBy: { sortOrder: 'asc' },
        select: { id: true, name: true, code: true },
      }),
      this.prisma.process.findMany({
        where: { deletedAt: null, ...departmentScopeWhere(scope) },
        select: { id: true, name: true, code: true, departmentId: true },
      }),
      this.prisma.documentCategory.findMany({ where: { active: true }, select: { id: true, name: true, code: true } }),
    ]);

    const processById = new Map(processes.map((process) => [process.id, process]));
    const categoryById = new Map(categories.map((category) => [category.id, category]));

    // count per (process, category) and per department
    const processCategoryCount = new Map<string, number>();
    const departmentCount = new Map<string, number>();
    for (const combo of combos) {
      const key = `${combo.processId ?? 'none'}::${combo.categoryId}`;
      processCategoryCount.set(key, (processCategoryCount.get(key) ?? 0) + (combo._count._all ?? 0));
      departmentCount.set(combo.departmentId, (departmentCount.get(combo.departmentId) ?? 0) + (combo._count._all ?? 0));
    }

    return departments
      .filter((department) => (departmentCount.get(department.id) ?? 0) > 0)
      .map((department) => ({
        id: department.id,
        name: department.name,
        code: department.code,
        type: 'department' as const,
        count: departmentCount.get(department.id) ?? 0,
        children: processes
          .filter((process) => process.departmentId === department.id)
          .map((process) => ({
            id: process.id,
            name: process.name,
            code: process.code,
            type: 'process' as const,
            count: combos
              .filter((combo) => combo.processId === process.id)
              .reduce((sum, combo) => sum + (combo._count._all ?? 0), 0),
            children: categories
              .map((category) => ({
                id: category.id,
                name: category.name,
                code: category.code,
                type: 'category' as const,
                count: processCategoryCount.get(`${process.id}::${category.id}`) ?? 0,
              }))
              .filter((category) => category.count > 0),
          }))
          .filter((process) => process.count > 0),
      }));
  }

  async findOne(id: string, scope: DataScope | undefined): Promise<DocumentDto> {
    const doc = await this.prisma.controlledDocument.findFirst({
      where: { id, ...departmentScopeWhere(scope) },
      include: DOC_INCLUDE,
    });
    if (!doc) {
      throw new NotFoundException('Document not found');
    }
    return toDocumentDto(doc);
  }

  async create(dto: CreateDocumentDto, actor: ActorContext): Promise<DocumentDto> {
    await this.assertRelations(dto.departmentId, dto.categoryId, dto.processId);

    const doc = await this.prisma.controlledDocument.create({
      data: {
        title: dto.title,
        code: dto.code,
        description: dto.description ?? null,
        departmentId: dto.departmentId,
        processId: dto.processId ?? null,
        categoryId: dto.categoryId,
        ownerId: dto.ownerId ?? null,
        reviewerId: dto.reviewerId ?? null,
        approverId: dto.approverId ?? null,
        keywords: dto.keywords ?? [],
        confidentiality: dto.confidentiality ?? 'INTERNAL',
        effectiveDate: dto.effectiveDate ? new Date(dto.effectiveDate) : null,
        reviewDate: dto.reviewDate ? new Date(dto.reviewDate) : null,
        expirationDate: dto.expirationDate ? new Date(dto.expirationDate) : null,
        createdById: actor.actorId ?? '',
      },
      include: DOC_INCLUDE,
    });

    await this.audit(actor, AUDIT_ACTIONS.DOCUMENT_CREATE, doc.id, { code: doc.code });
    return toDocumentDto(doc);
  }

  async update(id: string, dto: UpdateDocumentDto, actor: ActorContext): Promise<DocumentDto> {
    const current = await this.prisma.controlledDocument.findFirst({ where: { id, deletedAt: null }, include: DOC_INCLUDE });
    if (!current) {
      throw new NotFoundException('Document not found');
    }
    if (dto.departmentId || dto.categoryId || dto.processId !== undefined) {
      await this.assertRelations(
        dto.departmentId ?? current.departmentId,
        dto.categoryId ?? current.categoryId,
        dto.processId === undefined ? current.processId ?? undefined : dto.processId || undefined,
      );
    }

    const data: Prisma.ControlledDocumentUncheckedUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.code !== undefined) data.code = dto.code;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.departmentId !== undefined) data.departmentId = dto.departmentId;
    if (dto.processId !== undefined) data.processId = dto.processId;
    if (dto.categoryId !== undefined) data.categoryId = dto.categoryId;
    if (dto.ownerId !== undefined) data.ownerId = dto.ownerId;
    if (dto.reviewerId !== undefined) data.reviewerId = dto.reviewerId;
    if (dto.approverId !== undefined) data.approverId = dto.approverId;
    if (dto.keywords !== undefined) data.keywords = dto.keywords;
    if (dto.confidentiality !== undefined) data.confidentiality = dto.confidentiality;
    if (dto.effectiveDate !== undefined) data.effectiveDate = dto.effectiveDate ? new Date(dto.effectiveDate) : null;
    if (dto.reviewDate !== undefined) data.reviewDate = dto.reviewDate ? new Date(dto.reviewDate) : null;
    if (dto.expirationDate !== undefined) data.expirationDate = dto.expirationDate ? new Date(dto.expirationDate) : null;
    data.updatedById = actor.actorId;

    const updated = await this.prisma.controlledDocument.update({
      where: { id },
      data,
      include: DOC_INCLUDE,
    });

    await this.audit(actor, AUDIT_ACTIONS.DOCUMENT_UPDATE, id);
    return toDocumentDto(updated);
  }

  async changeStatus(id: string, status: DocumentStatus, actor: ActorContext): Promise<DocumentDto> {
    const current = await this.prisma.controlledDocument.findFirst({ where: { id, deletedAt: null }, include: DOC_INCLUDE });
    if (!current) {
      throw new NotFoundException('Document not found');
    }
    if (!TRANSITIONS[current.status].includes(status)) {
      throw new ConflictException(`Cannot transition a document from ${current.status} to ${status}`);
    }

    const data: Prisma.ControlledDocumentUncheckedUpdateInput = {
      status,
      updatedById: actor.actorId,
      ...(status === 'PUBLISHED' && !current.effectiveDate ? { effectiveDate: new Date() } : {}),
    };
    const updated = await this.prisma.controlledDocument.update({ where: { id }, data, include: DOC_INCLUDE });

    await this.audit(actor, AUDIT_ACTIONS.DOCUMENT_STATUS_CHANGE, id, { from: current.status, to: status });
    return toDocumentDto(updated);
  }

  async archive(id: string, actor: ActorContext): Promise<void> {
    await this.changeStatus(id, 'OBSOLETE', actor);
    await this.audit(actor, AUDIT_ACTIONS.DOCUMENT_ARCHIVE, id);
  }

  async restore(id: string, actor: ActorContext): Promise<DocumentDto> {
    const current = await this.prisma.controlledDocument.findFirst({ where: { id }, include: DOC_INCLUDE });
    if (!current) {
      throw new NotFoundException('Document not found');
    }
    const restored = await this.prisma.controlledDocument.update({
      where: { id },
      data: { deletedAt: null, status: 'DRAFT', updatedById: actor.actorId } satisfies Prisma.ControlledDocumentUncheckedUpdateInput,
      include: DOC_INCLUDE,
    });
    await this.audit(actor, AUDIT_ACTIONS.DOCUMENT_RESTORE, id);
    return toDocumentDto(restored);
  }

  /** Soft delete (status ARCHIVED + deletedAt). Never hard-removed. */
  async remove(id: string, actor: ActorContext): Promise<void> {
    const doc = await this.prisma.controlledDocument.findFirst({ where: { id, deletedAt: null } });
    if (!doc) {
      throw new NotFoundException('Document not found');
    }
    await this.prisma.controlledDocument.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'ARCHIVED', updatedById: actor.actorId } satisfies Prisma.ControlledDocumentUncheckedUpdateInput,
    });
    await this.audit(actor, AUDIT_ACTIONS.DOCUMENT_DELETE, id, { code: doc.code });
  }

  // ----------------------------------------------------------------- internals

  private async assertRelations(departmentId: string, categoryId: string, processId?: string | null): Promise<void> {
    const department = await this.prisma.department.findUnique({ where: { id: departmentId } });
    if (!department) {
      throw new NotFoundException('Department not found');
    }
    const category = await this.prisma.documentCategory.findUnique({ where: { id: categoryId } });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    if (processId) {
      const process = await this.prisma.process.findFirst({ where: { id: processId, departmentId } });
      if (!process) {
        throw new NotFoundException('Process not found in this department');
      }
    }
  }

  private async audit(actor: ActorContext, action: string, entityId: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.auditLog.record({
      actorId: actor.actorId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      action,
      entityType: 'document',
      entityId,
      metadata: metadata ?? null,
    });
  }
}

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AUDIT_ACTIONS, type DocumentCategoryDto, type PaginatedResult } from '@tecpap/types';
import type { Prisma } from '@prisma/client';
import type { ActorContext } from '../../common/context/actor';
import { paginated, parsePagination, parseSort } from '../../common/pagination/pagination';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateCategoryDto, ListCategoriesQuery, UpdateCategoryDto } from './dto/categories.dto';

const CATEGORY_INCLUDE = { _count: { select: { documents: true } } } satisfies Prisma.DocumentCategoryInclude;

@Injectable()
export class DocumentCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  /** Lightweight list for dropdowns/trees (active only). */
  async listActive(): Promise<DocumentCategoryDto[]> {
    const categories = await this.prisma.documentCategory.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
      include: CATEGORY_INCLUDE,
    });
    return categories.map((category) => this.toDto(category));
  }

  async list(query: ListCategoriesQuery): Promise<PaginatedResult<DocumentCategoryDto>> {
    const { skip, take, page, pageSize, sort, search } = parsePagination(query);
    const where: Prisma.DocumentCategoryWhereInput = {
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      ...(query.active !== undefined ? { active: query.active } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.documentCategory.findMany({
        where,
        skip,
        take,
        orderBy: parseSort(sort, ['name', 'sortOrder', 'createdAt'], { sortOrder: 'asc' }),
        include: CATEGORY_INCLUDE,
      }),
      this.prisma.documentCategory.count({ where }),
    ]);
    return paginated(rows.map((row) => this.toDto(row)), total, page, pageSize);
  }

  async create(dto: CreateCategoryDto, actor: ActorContext): Promise<DocumentCategoryDto> {
    const category = await this.prisma.documentCategory.create({
      data: {
        code: dto.code.toUpperCase(),
        name: dto.name,
        icon: dto.icon ?? null,
        color: dto.color ?? null,
        description: dto.description ?? null,
        active: dto.active ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
      include: CATEGORY_INCLUDE,
    });
    await this.audit(actor, AUDIT_ACTIONS.CATEGORY_CREATE, category.id, { code: category.code });
    return this.toDto(category);
  }

  async update(id: string, dto: UpdateCategoryDto, actor: ActorContext): Promise<DocumentCategoryDto> {
    const existing = await this.prisma.documentCategory.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Category not found');
    }
    const data: Prisma.DocumentCategoryUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.icon !== undefined) data.icon = dto.icon;
    if (dto.color !== undefined) data.color = dto.color;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.active !== undefined) data.active = dto.active;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    const updated = await this.prisma.documentCategory.update({ where: { id }, data, include: CATEGORY_INCLUDE });
    await this.audit(actor, AUDIT_ACTIONS.CATEGORY_UPDATE, id);
    return this.toDto(updated);
  }

  async remove(id: string, actor: ActorContext): Promise<void> {
    const category = await this.prisma.documentCategory.findUnique({
      where: { id },
      include: { _count: { select: { documents: true } } },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    if (category._count.documents > 0) {
      throw new ConflictException('Cannot delete a category that is still in use');
    }
    await this.prisma.documentCategory.delete({ where: { id } });
    await this.audit(actor, AUDIT_ACTIONS.CATEGORY_DELETE, id, { code: category.code });
  }

  private toDto(category: {
    id: string;
    code: string;
    name: string;
    icon: string | null;
    color: string | null;
    description: string | null;
    active: boolean;
    sortOrder: number;
    _count: { documents: number };
    createdAt: Date;
    updatedAt: Date;
  }): DocumentCategoryDto {
    return {
      id: category.id,
      code: category.code,
      name: category.name,
      icon: category.icon,
      color: category.color,
      description: category.description,
      active: category.active,
      sortOrder: category.sortOrder,
      documentCount: category._count.documents,
      createdAt: category.createdAt.toISOString(),
      updatedAt: category.updatedAt.toISOString(),
    };
  }

  private async audit(actor: ActorContext, action: string, entityId: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.auditLog.record({
      actorId: actor.actorId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      action,
      entityType: 'category',
      entityId,
      metadata: metadata ?? null,
    });
  }
}

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { BusinessObjectTypeDto, PaginatedResult } from '@tecpap/types';
import type { Prisma } from '@prisma/client';
import type { ActorContext } from '../../common/context/actor';
import { paginated, parsePagination, parseSort } from '../../common/pagination/pagination';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateBusinessObjectTypeDto, UpdateBusinessObjectTypeDto } from './dto/business-objects.dto';

const INCLUDE = { _count: { select: { objects: true } } } satisfies Prisma.BusinessObjectTypeInclude;

@Injectable()
export class BusinessObjectTypesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async listActive(): Promise<BusinessObjectTypeDto[]> {
    const types = await this.prisma.businessObjectType.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' }, include: INCLUDE });
    return types.map((type) => this.toDto(type));
  }

  async list(query: { page?: string; pageSize?: string; search?: string }): Promise<PaginatedResult<BusinessObjectTypeDto>> {
    const { skip, take, page, pageSize, search } = parsePagination(query);
    const where: Prisma.BusinessObjectTypeWhereInput = search ? { name: { contains: search, mode: 'insensitive' } } : {};
    const [rows, total] = await Promise.all([
      this.prisma.businessObjectType.findMany({ where, skip, take, orderBy: parseSort(undefined, ['name', 'sortOrder'], { sortOrder: 'asc' }), include: INCLUDE }),
      this.prisma.businessObjectType.count({ where }),
    ]);
    return paginated(rows.map((row) => this.toDto(row)), total, page, pageSize);
  }

  async create(dto: CreateBusinessObjectTypeDto, actor: ActorContext): Promise<BusinessObjectTypeDto> {
    const type = await this.prisma.businessObjectType.create({
      data: { code: dto.code.toUpperCase(), name: dto.name, icon: dto.icon ?? null, color: dto.color ?? null, description: dto.description ?? null, active: dto.active ?? true, sortOrder: dto.sortOrder ?? 0 },
      include: INCLUDE,
    });
    await this.audit(actor, 'business_object_type.create', type.id, { code: type.code });
    return this.toDto(type);
  }

  async update(id: string, dto: UpdateBusinessObjectTypeDto, actor: ActorContext): Promise<BusinessObjectTypeDto> {
    const data: Prisma.BusinessObjectTypeUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.icon !== undefined) data.icon = dto.icon;
    if (dto.color !== undefined) data.color = dto.color;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.active !== undefined) data.active = dto.active;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    const updated = await this.prisma.businessObjectType.update({ where: { id }, data, include: INCLUDE });
    await this.audit(actor, 'business_object_type.update', id);
    return this.toDto(updated);
  }

  async remove(id: string, actor: ActorContext): Promise<void> {
    const type = await this.prisma.businessObjectType.findUnique({ where: { id }, include: { _count: { select: { objects: true } } } });
    if (!type) throw new NotFoundException('Type not found');
    if (type._count.objects > 0) throw new ConflictException('Cannot delete a type that is still in use');
    await this.prisma.businessObjectType.delete({ where: { id } });
    await this.audit(actor, 'business_object_type.delete', id, { code: type.code });
  }

  private toDto(type: { id: string; code: string; name: string; icon: string | null; color: string | null; description: string | null; active: boolean; sortOrder: number; _count: { objects: number }; createdAt: Date; updatedAt: Date; }): BusinessObjectTypeDto {
    return { id: type.id, code: type.code, name: type.name, icon: type.icon, color: type.color, description: type.description, active: type.active, sortOrder: type.sortOrder, objectCount: type._count.objects, createdAt: type.createdAt.toISOString(), updatedAt: type.updatedAt.toISOString() };
  }

  private async audit(actor: ActorContext, action: string, entityId: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.auditLog.record({ actorId: actor.actorId, ipAddress: actor.ipAddress, userAgent: actor.userAgent, action, entityType: 'business_object_type', entityId, metadata: metadata ?? null });
  }
}

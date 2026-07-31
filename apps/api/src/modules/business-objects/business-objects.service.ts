import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { BusinessObjectDto, PaginatedResult } from '@tecpap/types';
import type { Prisma } from '@prisma/client';
import type { ActorContext } from '../../common/context/actor';
import { paginated, parsePagination, parseSort } from '../../common/pagination/pagination';
import { departmentScopeWhere } from '../../common/scoping/scope';
import type { DataScope } from '../../common/types/data-scope';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateBusinessObjectDto, ListBusinessObjectsQuery, UpdateBusinessObjectDto } from './dto/business-objects.dto';

const INCLUDE = {
  type: { select: { id: true, name: true } },
  department: { select: { id: true, name: true } },
  process: { select: { id: true, name: true } },
  owner: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.BusinessObjectInclude;

@Injectable()
export class BusinessObjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly timeline: ActivityTimelineService,
  ) {}

  async list(query: ListBusinessObjectsQuery, scope: DataScope | undefined): Promise<PaginatedResult<BusinessObjectDto>> {
    const { skip, take, page, pageSize, sort, search } = parsePagination(query);
    const base: Prisma.BusinessObjectWhereInput = {
      deletedAt: null,
      ...(query.typeId ? { typeId: query.typeId } : {}),
      ...(query.processId ? { processId: query.processId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { code: { contains: search, mode: 'insensitive' } }] } : {}),
    };
    const where = departmentScopeWhere(scope, { ...base, ...(query.departmentId ? { departmentId: query.departmentId } : {}) }) as Prisma.BusinessObjectWhereInput;

    const [rows, total] = await Promise.all([
      this.prisma.businessObject.findMany({ where, skip, take, orderBy: parseSort(sort, ['name', 'code', 'createdAt'], { updatedAt: 'desc' }), include: INCLUDE }),
      this.prisma.businessObject.count({ where }),
    ]);
    return paginated(rows.map((row) => this.toDto(row)), total, page, pageSize);
  }

  async findOne(id: string, scope: DataScope | undefined): Promise<BusinessObjectDto> {
    const object = await this.prisma.businessObject.findFirst({ where: { id, ...departmentScopeWhere(scope) }, include: INCLUDE });
    if (!object) throw new NotFoundException('Business object not found');
    return this.toDto(object);
  }

  async create(dto: CreateBusinessObjectDto, actor: ActorContext): Promise<BusinessObjectDto> {
    await this.assertRelations(dto.typeId, dto.departmentId, dto.processId);
    const existing = await this.prisma.businessObject.findUnique({ where: { departmentId_code: { departmentId: dto.departmentId, code: dto.code } } });
    if (existing) throw new ConflictException('A business object with this code already exists in this department');

    const object = await this.prisma.businessObject.create({
      data: {
        typeId: dto.typeId, departmentId: dto.departmentId, processId: dto.processId ?? null,
        name: dto.name, code: dto.code, status: dto.status ?? 'ACTIVE',
        attributes: (dto.attributes as Prisma.InputJsonValue) ?? undefined, ownerId: dto.ownerId ?? null, createdById: actor.actorId ?? '',
      },
      include: INCLUDE,
    });
    await this.timeline.record({ processId: dto.processId, eventType: 'business_object.created', title: `${object.name} created`, entityType: 'business_object', entityId: object.id, actorId: actor.actorId });
    await this.audit(actor, 'business_object.create', object.id, { code: object.code });
    return this.toDto(object);
  }

  async update(id: string, dto: UpdateBusinessObjectDto, actor: ActorContext): Promise<BusinessObjectDto> {
    const current = await this.prisma.businessObject.findFirst({ where: { id, deletedAt: null }, include: INCLUDE });
    if (!current) throw new NotFoundException('Business object not found');
    const data: Prisma.BusinessObjectUncheckedUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.code !== undefined) data.code = dto.code;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.attributes !== undefined) data.attributes = dto.attributes as Prisma.InputJsonValue;
    if (dto.ownerId !== undefined) data.ownerId = dto.ownerId;
    if (dto.processId !== undefined) data.processId = dto.processId;
    const updated = await this.prisma.businessObject.update({ where: { id }, data, include: INCLUDE });
    await this.timeline.record({ processId: updated.processId, eventType: 'business_object.updated', title: `${updated.name} updated`, entityType: 'business_object', entityId: id, actorId: actor.actorId });
    await this.audit(actor, 'business_object.update', id);
    return this.toDto(updated);
  }

  async remove(id: string, actor: ActorContext): Promise<void> {
    const object = await this.prisma.businessObject.findFirst({ where: { id, deletedAt: null } });
    if (!object) throw new NotFoundException('Business object not found');
    await this.prisma.businessObject.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit(actor, 'business_object.delete', id, { code: object.code });
  }

  private async assertRelations(typeId: string, departmentId: string, processId?: string | null): Promise<void> {
    const type = await this.prisma.businessObjectType.findUnique({ where: { id: typeId } });
    if (!type) throw new NotFoundException('Business object type not found');
    const department = await this.prisma.department.findUnique({ where: { id: departmentId } });
    if (!department) throw new NotFoundException('Department not found');
    if (processId) {
      const process = await this.prisma.process.findFirst({ where: { id: processId, departmentId } });
      if (!process) throw new NotFoundException('Process not found in this department');
    }
  }

  private toDto(object: {
    id: string; typeId: string; departmentId: string; processId: string | null; name: string; code: string; status: string;
    attributes: Prisma.JsonValue; ownerId: string | null; createdById: string; createdAt: Date; updatedAt: Date;
    type: { name: string } | null; department: { name: string } | null; process: { name: string } | null; owner: { firstName: string; lastName: string } | null;
  }): BusinessObjectDto {
    return {
      id: object.id, typeId: object.typeId, typeName: object.type?.name ?? null,
      departmentId: object.departmentId, departmentName: object.department?.name ?? null,
      processId: object.processId, processName: object.process?.name ?? null,
      name: object.name, code: object.code, status: object.status,
      attributes: (object.attributes as Record<string, unknown> | null) ?? null,
      ownerId: object.ownerId, ownerName: object.owner ? `${object.owner.firstName} ${object.owner.lastName}` : null,
      createdById: object.createdById, createdAt: object.createdAt.toISOString(), updatedAt: object.updatedAt.toISOString(),
    };
  }

  private async audit(actor: ActorContext, action: string, entityId: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.auditLog.record({ actorId: actor.actorId, ipAddress: actor.ipAddress, userAgent: actor.userAgent, action, entityType: 'business_object', entityId, metadata: metadata ?? null });
  }
}

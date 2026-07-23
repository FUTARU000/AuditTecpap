import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AUDIT_ACTIONS, type DepartmentDto, type DepartmentStatsDto, type PaginatedResult } from '@tecpap/types';
import type { Prisma } from '@prisma/client';
import type { ActorContext } from '../../common/context/actor';
import { paginated, parsePagination, parseSort } from '../../common/pagination/pagination';
import { departmentScopeWhere } from '../../common/scoping/scope';
import type { DataScope } from '../../common/types/data-scope';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateDepartmentDto, ListDepartmentsQuery, UpdateDepartmentDto } from './dto/departments.dto';

const DEPT_INCLUDE = {
  manager: { select: { id: true, firstName: true, lastName: true } },
  _count: { select: { users: true } },
} satisfies Prisma.DepartmentInclude;

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(
    query: ListDepartmentsQuery,
    scope: DataScope | undefined,
  ): Promise<PaginatedResult<DepartmentDto>> {
    const { skip, take, page, pageSize, sort, search } = parsePagination(query);
    const where: Prisma.DepartmentWhereInput = {
      ...departmentScopeWhere(scope),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.department.findMany({
        where,
        skip,
        take,
        orderBy: parseSort(sort, ['name', 'code', 'sortOrder', 'createdAt'], { sortOrder: 'asc' }),
        include: DEPT_INCLUDE,
      }),
      this.prisma.department.count({ where }),
    ]);

    return paginated(rows.map((row) => this.toDto(row)), total, page, pageSize);
  }

  async stats(): Promise<DepartmentStatsDto> {
    const [total, active, inactive, departments] = await Promise.all([
      this.prisma.department.count(),
      this.prisma.department.count({ where: { status: 'ACTIVE' } }),
      this.prisma.department.count({ where: { status: 'INACTIVE' } }),
      this.prisma.department.findMany({
        orderBy: { sortOrder: 'asc' },
        include: { _count: { select: { users: true } } },
      }),
    ]);

    const byDepartment = departments.map((d) => ({
      id: d.id,
      name: d.name,
      code: d.code,
      memberCount: d._count.users,
    }));

    return {
      total,
      active,
      inactive,
      totalMembers: byDepartment.reduce((sum, d) => sum + d.memberCount, 0),
      byDepartment,
    };
  }

  async findOne(id: string, scope: DataScope | undefined): Promise<DepartmentDto> {
    const department = await this.prisma.department.findFirst({
      where: { id, ...departmentScopeWhere(scope) },
      include: DEPT_INCLUDE,
    });
    if (!department) {
      throw new NotFoundException('Department not found');
    }
    return this.toDto(department);
  }

  async create(dto: CreateDepartmentDto, actor: ActorContext): Promise<DepartmentDto> {
    if (dto.managerId) {
      await this.assertUserExists(dto.managerId);
    }
    const codeTaken = await this.prisma.department.findUnique({ where: { code: dto.code.toUpperCase() } });
    if (codeTaken) {
      throw new ConflictException('A department with this code already exists');
    }

    const department = await this.prisma.department.create({
      data: {
        code: dto.code.toUpperCase(),
        name: dto.name,
        description: dto.description ?? null,
        sortOrder: dto.sortOrder ?? 0,
        status: dto.status ?? 'ACTIVE',
        managerId: dto.managerId ?? null,
      },
      include: DEPT_INCLUDE,
    });

    await this.audit(actor, AUDIT_ACTIONS.DEPARTMENT_CREATE, department.id, { code: department.code });
    return this.toDto(department);
  }

  async update(id: string, dto: UpdateDepartmentDto, actor: ActorContext): Promise<DepartmentDto> {
    const current = await this.prisma.department.findUnique({ where: { id }, include: DEPT_INCLUDE });
    if (!current) {
      throw new NotFoundException('Department not found');
    }
    if (dto.managerId !== undefined && dto.managerId) {
      await this.assertUserExists(dto.managerId);
    }

    const data: Prisma.DepartmentUpdateInput = {};
    if (dto.code !== undefined) data.code = dto.code.toUpperCase();
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.managerId !== undefined) {
      data.manager = dto.managerId ? { connect: { id: dto.managerId } } : { disconnect: true };
    }

    const updated = await this.prisma.department.update({ where: { id }, data, include: DEPT_INCLUDE });

    await this.audit(actor, AUDIT_ACTIONS.DEPARTMENT_UPDATE, id);
    if (dto.managerId !== undefined && dto.managerId !== current.managerId) {
      await this.audit(actor, AUDIT_ACTIONS.DEPARTMENT_MANAGER_CHANGE, id, {
        from: current.managerId,
        to: dto.managerId,
      });
    }
    return this.toDto(updated);
  }

  async remove(id: string, actor: ActorContext): Promise<void> {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!department) {
      throw new NotFoundException('Department not found');
    }
    if (department._count.users > 0) {
      throw new ConflictException('Cannot delete a department that still has members');
    }
    await this.prisma.department.delete({ where: { id } });
    await this.audit(actor, AUDIT_ACTIONS.DEPARTMENT_DELETE, id, { code: department.code });
  }

  // ----------------------------------------------------------------- internals

  private async assertUserExists(userId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) {
      throw new NotFoundException('Manager user not found');
    }
  }

  private toDto(department: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    sortOrder: number;
    status: string;
    managerId: string | null;
    manager: { firstName: string; lastName: string } | null;
    _count: { users: number };
    createdAt: Date;
    updatedAt: Date;
  }): DepartmentDto {
    return {
      id: department.id,
      code: department.code,
      name: department.name,
      description: department.description,
      sortOrder: department.sortOrder,
      status: department.status as DepartmentDto['status'],
      managerId: department.managerId,
      managerName: department.manager
        ? `${department.manager.firstName} ${department.manager.lastName}`
        : null,
      memberCount: department._count.users,
      createdAt: department.createdAt.toISOString(),
      updatedAt: department.updatedAt.toISOString(),
    };
  }

  private async audit(
    actor: ActorContext,
    action: string,
    entityId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.auditLog.record({
      actorId: actor.actorId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      action,
      entityType: 'department',
      entityId,
      metadata: metadata ?? null,
    });
  }
}

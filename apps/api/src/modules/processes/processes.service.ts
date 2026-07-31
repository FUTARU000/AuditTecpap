import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AUDIT_ACTIONS, type PaginatedResult, type ProcessDto, type ProcessStatus } from '@tecpap/types';
import type { Prisma } from '@prisma/client';
import type { ActorContext } from '../../common/context/actor';
import { paginated, parsePagination, parseSort } from '../../common/pagination/pagination';
import { departmentScopeWhere } from '../../common/scoping/scope';
import type { DataScope } from '../../common/types/data-scope';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateProcessDto, ListProcessesQuery, UpdateProcessDto } from './dto/processes.dto';

const PROCESS_INCLUDE = {
  department: { select: { id: true, name: true } },
  owner: { select: { id: true, firstName: true, lastName: true } },
  _count: { select: { documents: true } },
} satisfies Prisma.ProcessInclude;

@Injectable()
export class ProcessesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(query: ListProcessesQuery, scope: DataScope | undefined): Promise<PaginatedResult<ProcessDto>> {
    const { skip, take, page, pageSize, sort, search } = parsePagination(query);
    const where: Prisma.ProcessWhereInput = {
      deletedAt: null,
      ...departmentScopeWhere(scope, { ...(query.departmentId ? { departmentId: query.departmentId } : {}) }),
      ...(search
        ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { code: { contains: search, mode: 'insensitive' } }] }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.ownerId ? { ownerId: query.ownerId } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.process.findMany({
        where,
        skip,
        take,
        orderBy: parseSort(sort, ['name', 'code', 'createdAt', 'status'], { name: 'asc' }),
        include: PROCESS_INCLUDE,
      }),
      this.prisma.process.count({ where }),
    ]);

    return paginated(rows.map((row) => this.toDto(row)), total, page, pageSize);
  }

  async findOne(id: string, scope: DataScope | undefined): Promise<ProcessDto> {
    const process = await this.prisma.process.findFirst({
      where: { id, deletedAt: null, ...departmentScopeWhere(scope) },
      include: PROCESS_INCLUDE,
    });
    if (!process) {
      throw new NotFoundException('Process not found');
    }
    return this.toDto(process);
  }

  async create(dto: CreateProcessDto, actor: ActorContext): Promise<ProcessDto> {
    await this.assertDepartmentInScope(dto.departmentId, actor);
    const existing = await this.prisma.process.findUnique({
      where: { departmentId_code: { departmentId: dto.departmentId, code: dto.code } },
    });
    if (existing) {
      throw new ConflictException('A process with this code already exists in this department');
    }

    const process = await this.prisma.process.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description ?? null,
        departmentId: dto.departmentId,
        ownerId: dto.ownerId ?? null,
        objectives: dto.objectives ?? null,
        scope: dto.scope ?? null,
        risks: (dto.risks as Prisma.InputJsonValue) ?? undefined,
        opportunities: (dto.opportunities as Prisma.InputJsonValue) ?? undefined,
        kpis: (dto.kpis as Prisma.InputJsonValue) ?? undefined,
        status: dto.status ?? 'ACTIVE',
      },
      include: PROCESS_INCLUDE,
    });

    await this.audit(actor, AUDIT_ACTIONS.PROCESS_CREATE, process.id, { code: process.code });
    return this.toDto(process);
  }

  async update(id: string, dto: UpdateProcessDto, actor: ActorContext): Promise<ProcessDto> {
    const current = await this.prisma.process.findFirst({ where: { id, deletedAt: null }, include: PROCESS_INCLUDE });
    if (!current) {
      throw new NotFoundException('Process not found');
    }
    if (dto.departmentId && dto.departmentId !== current.departmentId) {
      await this.assertDepartmentInScope(dto.departmentId, actor);
    }

    const data: Prisma.ProcessUpdateInput = {};
    if (dto.code !== undefined) data.code = dto.code;
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.departmentId !== undefined) data.department = { connect: { id: dto.departmentId } };
    if (dto.ownerId !== undefined) data.owner = dto.ownerId ? { connect: { id: dto.ownerId } } : { disconnect: true };
    if (dto.objectives !== undefined) data.objectives = dto.objectives;
    if (dto.scope !== undefined) data.scope = dto.scope;
    if (dto.risks !== undefined) data.risks = dto.risks as Prisma.InputJsonValue;
    if (dto.opportunities !== undefined) data.opportunities = dto.opportunities as Prisma.InputJsonValue;
    if (dto.kpis !== undefined) data.kpis = dto.kpis as Prisma.InputJsonValue;
    if (dto.status !== undefined) data.status = dto.status;

    const updated = await this.prisma.process.update({
      where: { id },
      data: { ...data, revision: { increment: 1 } },
      include: PROCESS_INCLUDE,
    });

    await this.audit(actor, AUDIT_ACTIONS.PROCESS_UPDATE, id);
    return this.toDto(updated);
  }

  /** Soft delete (archive). Processes are never hard-removed. */
  async remove(id: string, actor: ActorContext): Promise<void> {
    const process = await this.prisma.process.findFirst({ where: { id, deletedAt: null } });
    if (!process) {
      throw new NotFoundException('Process not found');
    }
    await this.prisma.process.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'ARCHIVED' as ProcessStatus },
    });
    await this.audit(actor, AUDIT_ACTIONS.PROCESS_DELETE, id);
  }

  // ----------------------------------------------------------------- internals

  private async assertDepartmentInScope(departmentId: string, _actor: ActorContext): Promise<void> {
    const department = await this.prisma.department.findUnique({ where: { id: departmentId } });
    if (!department) {
      throw new NotFoundException('Department not found');
    }
  }

  private toDto(process: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    departmentId: string;
    department: { name: string } | null;
    ownerId: string | null;
    owner: { firstName: string; lastName: string } | null;
    objectives: string | null;
    scope: string | null;
    risks: unknown;
    opportunities: unknown;
    kpis: unknown;
    status: string;
    revision: number;
    _count: { documents: number };
    createdAt: Date;
    updatedAt: Date;
  }): ProcessDto {
    return {
      id: process.id,
      code: process.code,
      name: process.name,
      description: process.description,
      departmentId: process.departmentId,
      departmentName: process.department?.name ?? null,
      ownerId: process.ownerId,
      ownerName: process.owner ? `${process.owner.firstName} ${process.owner.lastName}` : null,
      objectives: process.objectives,
      scope: process.scope,
      risks: process.risks,
      opportunities: process.opportunities,
      kpis: process.kpis,
      status: process.status as ProcessDto['status'],
      revision: process.revision,
      documentCount: process._count.documents,
      createdAt: process.createdAt.toISOString(),
      updatedAt: process.updatedAt.toISOString(),
    };
  }

  private async audit(actor: ActorContext, action: string, entityId: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.auditLog.record({
      actorId: actor.actorId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      action,
      entityType: 'process',
      entityId,
      metadata: metadata ?? null,
    });
  }
}

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AUDIT_ACTIONS, type PaginatedResult, type RoleDto } from '@tecpap/types';
import type { Prisma } from '@prisma/client';
import type { ActorContext } from '../../common/context/actor';
import { paginated, parsePagination, parseSort } from '../../common/pagination/pagination';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateRoleDto, ListRolesQuery, UpdatePermissionsDto, UpdateRoleDto } from './dto/roles.dto';

const ROLE_INCLUDE = {
  permissions: { select: { key: true } },
  _count: { select: { users: true } },
} satisfies Prisma.RoleInclude;

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(query: ListRolesQuery): Promise<PaginatedResult<RoleDto>> {
    const { skip, take, page, pageSize, sort, search } = parsePagination(query);
    const where: Prisma.RoleWhereInput = search
      ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { slug: { contains: search, mode: 'insensitive' } }] }
      : {};

    const [rows, total] = await Promise.all([
      this.prisma.role.findMany({
        where,
        skip,
        take,
        orderBy: parseSort(sort, ['name', 'createdAt'], { createdAt: 'desc' }),
        include: ROLE_INCLUDE,
      }),
      this.prisma.role.count({ where }),
    ]);

    return paginated(rows.map((row) => this.toDto(row)), total, page, pageSize);
  }

  async findOne(id: string): Promise<RoleDto> {
    const role = await this.prisma.role.findUnique({ where: { id }, include: ROLE_INCLUDE });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    return this.toDto(role);
  }

  async create(dto: CreateRoleDto, actor: ActorContext): Promise<RoleDto> {
    const keys = await this.validatePermissions(dto.permissions);
    const slug = await this.uniqueSlug(dto.name);

    const role = await this.prisma.role.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description ?? null,
        isSystem: false,
        isGlobal: dto.isGlobal ?? false,
        permissions: { connect: keys.map((key) => ({ key })) },
      },
      include: ROLE_INCLUDE,
    });

    await this.audit(actor, AUDIT_ACTIONS.ROLE_CREATE, role.id, { name: role.name, permissions: dto.permissions });
    return this.toDto(role);
  }

  async update(id: string, dto: UpdateRoleDto, actor: ActorContext): Promise<RoleDto> {
    const current = await this.prisma.role.findUnique({ where: { id }, include: ROLE_INCLUDE });
    if (!current) {
      throw new NotFoundException('Role not found');
    }

    const data: Prisma.RoleUpdateInput = {};
    if (dto.name !== undefined && dto.name !== current.name) {
      data.name = dto.name;
      data.slug = await this.uniqueSlug(dto.name, id);
    }
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.isGlobal !== undefined) data.isGlobal = dto.isGlobal;

    if (dto.permissions !== undefined) {
      const keys = await this.validatePermissions(dto.permissions);
      data.permissions = { set: keys.map((key) => ({ key })) };
    }

    const updated = await this.prisma.role.update({ where: { id }, data, include: ROLE_INCLUDE });

    await this.audit(actor, AUDIT_ACTIONS.ROLE_UPDATE, id);
    if (dto.permissions !== undefined) {
      await this.audit(actor, AUDIT_ACTIONS.ROLE_PERMISSIONS_CHANGE, id, {
        from: current.permissions.map((p) => p.key),
        to: dto.permissions,
      });
    }
    return this.toDto(updated);
  }

  async setPermissions(id: string, dto: UpdatePermissionsDto, actor: ActorContext): Promise<RoleDto> {
    return this.update(id, { permissions: dto.permissions }, actor);
  }

  async remove(id: string, actor: ActorContext): Promise<void> {
    const role = await this.prisma.role.findUnique({ where: { id }, include: { _count: { select: { users: true } } } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    if (role.isSystem) {
      throw new ConflictException('System roles cannot be deleted');
    }
    if (role._count.users > 0) {
      throw new ConflictException('Cannot delete a role that is assigned to users');
    }
    await this.prisma.role.delete({ where: { id } });
    await this.audit(actor, AUDIT_ACTIONS.ROLE_DELETE, id, { name: role.name });
  }

  // ----------------------------------------------------------------- internals

  private async validatePermissions(keys: string[]): Promise<string[]> {
    if (keys.length === 0) {
      return [];
    }
    const existing = await this.prisma.permission.findMany({
      where: { key: { in: keys } },
      select: { key: true },
    });
    const valid = new Set(existing.map((p) => p.key));
    const invalid = keys.filter((key) => !valid.has(key));
    if (invalid.length > 0) {
      throw new BadRequestException(`Unknown permission keys: ${invalid.join(', ')}`);
    }
    return keys;
  }

  private async uniqueSlug(name: string, excludeId?: string): Promise<string> {
    const base = name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    let slug = base || 'role';
    let suffix = 1;
    while (await this.prisma.role.findFirst({ where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) } })) {
      suffix += 1;
      slug = `${base}-${suffix}`;
    }
    return slug;
  }

  private toDto(role: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    isSystem: boolean;
    isGlobal: boolean;
    permissions: { key: string }[];
    _count: { users: number };
    createdAt: Date;
    updatedAt: Date;
  }): RoleDto {
    return {
      id: role.id,
      name: role.name,
      slug: role.slug,
      description: role.description,
      isSystem: role.isSystem,
      isGlobal: role.isGlobal,
      permissions: role.permissions.map((p) => p.key),
      userCount: role._count.users,
      createdAt: role.createdAt.toISOString(),
      updatedAt: role.updatedAt.toISOString(),
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
      entityType: 'role',
      entityId,
      metadata: metadata ?? null,
    });
  }
}

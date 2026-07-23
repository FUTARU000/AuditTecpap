import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AUDIT_ACTIONS, type PaginatedResult, type UserDto, type UserStatus } from '@tecpap/types';
import type { Prisma } from '@prisma/client';
import type { ActorContext } from '../../common/context/actor';
import { USER_INCLUDE, toUserDto, type UserWithRelations } from '../../common/mappers/user.mapper';
import { paginated, parsePagination, parseSort } from '../../common/pagination/pagination';
import { departmentScopeWhere } from '../../common/scoping/scope';
import type { DataScope } from '../../common/types/data-scope';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthService } from '../auth/auth.service';
import { CryptoService } from '../auth/crypto.service';
import { PrismaService } from '../prisma/prisma.service';
import type { BulkUserStatusDto, CreateUserDto, ListUsersQuery, UpdateUserDto } from './dto/users.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly crypto: CryptoService,
    private readonly auth: AuthService,
  ) {}

  async list(query: ListUsersQuery, scope: DataScope | undefined): Promise<PaginatedResult<UserDto>> {
    const { skip, take, page, pageSize, sort, search } = parsePagination(query);
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...departmentScopeWhere(scope),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.roleId ? { roleId: query.roleId } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: parseSort(sort, ['firstName', 'lastName', 'email', 'status', 'createdAt'], {
          createdAt: 'desc',
        }),
        include: USER_INCLUDE,
      }),
      this.prisma.user.count({ where }),
    ]);

    return paginated(rows.map((row) => toUserDto(row)), total, page, pageSize);
  }

  async findOne(id: string, scope: DataScope | undefined): Promise<UserDto> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null, ...departmentScopeWhere(scope) },
      include: USER_INCLUDE,
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return toUserDto(user);
  }

  async create(dto: CreateUserDto, actor: ActorContext): Promise<UserDto> {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }
    await this.assertRoleExists(dto.roleId);
    if (dto.departmentId) {
      await this.assertDepartmentExists(dto.departmentId);
    }

    const user = await this.prisma.user.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email,
        passwordHash: await this.crypto.hash(dto.password),
        employeeNumber: dto.employeeNumber ?? null,
        phone: dto.phone ?? null,
        roleId: dto.roleId,
        departmentId: dto.departmentId ?? null,
        status: dto.status ?? 'ACTIVE',
      },
      include: USER_INCLUDE,
    });

    await this.audit({
      actor,
      action: AUDIT_ACTIONS.USER_CREATE,
      entityId: user.id,
      target: email,
    });
    return toUserDto(user);
  }

  async update(id: string, dto: UpdateUserDto, actor: ActorContext): Promise<UserDto> {
    const current = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: USER_INCLUDE,
    });
    if (!current) {
      throw new NotFoundException('User not found');
    }
    if (dto.roleId) {
      await this.assertRoleExists(dto.roleId);
    }
    if (dto.departmentId) {
      await this.assertDepartmentExists(dto.departmentId);
    }
    if (dto.email && dto.email.toLowerCase() !== current.email) {
      const taken = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
      if (taken) {
        throw new ConflictException('A user with this email already exists');
      }
    }

    const data: Prisma.UserUpdateInput = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.email !== undefined) data.email = dto.email.toLowerCase();
    if (dto.employeeNumber !== undefined) data.employeeNumber = dto.employeeNumber;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.roleId !== undefined) data.role = { connect: { id: dto.roleId } };
    if (dto.departmentId !== undefined) {
      data.department = dto.departmentId ? { connect: { id: dto.departmentId } } : { disconnect: true };
    }
    if (dto.status !== undefined) data.status = dto.status;

    const updated = await this.prisma.user.update({ where: { id }, data, include: USER_INCLUDE });

    await this.audit({ actor, action: AUDIT_ACTIONS.USER_UPDATE, entityId: id, target: updated.email });
    if (dto.status && dto.status !== current.status) {
      await this.audit({
        actor,
        action: AUDIT_ACTIONS.USER_STATUS_CHANGE,
        entityId: id,
        metadata: { from: current.status, to: dto.status },
      });
    }
    if (dto.roleId && dto.roleId !== current.roleId) {
      await this.audit({
        actor,
        action: AUDIT_ACTIONS.USER_ROLE_CHANGE,
        entityId: id,
        metadata: { from: current.roleId, to: dto.roleId },
      });
    }
    if (dto.departmentId !== undefined && dto.departmentId !== current.departmentId) {
      await this.audit({
        actor,
        action: AUDIT_ACTIONS.USER_DEPARTMENT_CHANGE,
        entityId: id,
        metadata: { from: current.departmentId, to: dto.departmentId },
      });
    }

    return toUserDto(updated);
  }

  /** Soft delete only — users are never permanently removed. */
  async remove(id: string, actor: ActorContext): Promise<void> {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'INACTIVE' },
    });
    await this.auth.revokeAllForUser(id);
    await this.audit({ actor, action: AUDIT_ACTIONS.USER_UPDATE, entityId: id, target: user.email });
  }

  async bulkStatus(dto: BulkUserStatusDto, actor: ActorContext): Promise<{ updated: number }> {
    const result = await this.prisma.user.updateMany({
      where: { id: { in: dto.ids }, deletedAt: null },
      data: { status: dto.status as UserStatus },
    });
    await this.audit({
      actor,
      action: AUDIT_ACTIONS.USER_STATUS_CHANGE,
      entityId: null,
      metadata: { ids: dto.ids, status: dto.status, count: result.count },
    });
    return { updated: result.count };
  }

  async resetPassword(id: string, actor: ActorContext): Promise<{ resetToken: string }> {
    const token = await this.auth.generateResetToken(id);
    if (!token) {
      throw new NotFoundException('User not found');
    }
    await this.audit({ actor, action: AUDIT_ACTIONS.USER_PASSWORD_RESET, entityId: id });
    return { resetToken: token };
  }

  // ----------------------------------------------------------------- internals

  private async assertRoleExists(roleId: string): Promise<void> {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
  }

  private async assertDepartmentExists(departmentId: string): Promise<void> {
    const department = await this.prisma.department.findUnique({ where: { id: departmentId } });
    if (!department) {
      throw new NotFoundException('Department not found');
    }
  }

  private async audit(input: {
    actor: ActorContext;
    action: string;
    entityId: string | null;
    target?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.auditLog.record({
      actorId: input.actor.actorId,
      ipAddress: input.actor.ipAddress,
      userAgent: input.actor.userAgent,
      action: input.action,
      entityType: 'user',
      entityId: input.entityId,
      target: input.target,
      metadata: input.metadata ?? null,
    });
  }

  /** Re-exported mapper for other modules that need a fresh user DTO. */
  map(user: UserWithRelations): UserDto {
    return toUserDto(user);
  }
}

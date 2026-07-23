import type { Prisma } from '@prisma/client';
import type { AuthUser, UserDto } from '@tecpap/types';

/** Shared include used wherever a full user (with role permissions + department) is read. */
export const USER_INCLUDE = {
  role: { include: { permissions: { select: { key: true } } } },
  department: { select: { id: true, name: true } },
} satisfies Prisma.UserInclude;

/** Prisma user row including the relations above. */
export type UserWithRelations = Prisma.UserGetPayload<{ include: typeof USER_INCLUDE }>;

export function toAuthUser(user: UserWithRelations): AuthUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role.slug,
    roleIsGlobal: user.role.isGlobal,
    departmentId: user.departmentId,
    permissions: user.role.permissions.map((permission) => permission.key),
  };
}

export function toUserDto(user: UserWithRelations): UserDto {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    employeeNumber: user.employeeNumber,
    phone: user.phone,
    avatar: user.avatar,
    departmentId: user.departmentId,
    departmentName: user.department?.name ?? null,
    roleId: user.roleId,
    roleName: user.role.name,
    roleSlug: user.role.slug,
    status: user.status,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

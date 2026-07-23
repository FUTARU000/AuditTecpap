import type { UserStatus } from './enums';

/** Public user representation — never exposes passwordHash. */
export interface UserDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  employeeNumber: string | null;
  phone: string | null;
  avatar: string | null;
  departmentId: string | null;
  departmentName: string | null;
  roleId: string;
  roleName: string | null;
  roleSlug: string | null;
  status: UserStatus;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Fields accepted when creating a user. */
export interface CreateUserDto {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  employeeNumber?: string | null;
  phone?: string | null;
  departmentId?: string | null;
  roleId?: string;
  status?: UserStatus;
}

/** Fields accepted when updating a user (all optional). */
export interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  email?: string;
  employeeNumber?: string | null;
  phone?: string | null;
  avatar?: string | null;
  departmentId?: string | null;
  roleId?: string;
  status?: UserStatus;
}

/** Body for the change-password flow. */
export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

/** Body for a bulk status change. */
export interface BulkUserStatusDto {
  ids: string[];
  status: UserStatus;
}

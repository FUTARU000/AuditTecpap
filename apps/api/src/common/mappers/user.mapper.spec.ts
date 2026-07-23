import { describe, expect, it } from 'vitest';
import { toAuthUser, toUserDto, type UserWithRelations } from './user.mapper';

const baseUser = {
  id: 'u1',
  firstName: 'Amina',
  lastName: 'Bennani',
  email: 'amina@tecpap.ma',
  employeeNumber: 'EMP-1',
  phone: '+212600000000',
  avatar: null,
  departmentId: 'd1',
  status: 'ACTIVE',
  lastLoginAt: null,
  failedLoginCount: 0,
  lockedUntil: null,
  passwordResetToken: null,
  passwordResetExpiresAt: null,
  deletedAt: null,
  roleId: 'r1',
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  updatedAt: new Date('2025-01-02T00:00:00.000Z'),
  role: { id: 'r1', name: 'Pilot', slug: 'pilot', isGlobal: false, permissions: [{ key: 'dashboard.read' }, { key: 'audits.execute' }] },
  department: { id: 'd1', name: 'Production' },
} as unknown as UserWithRelations;

describe('toAuthUser', () => {
  it('maps the role slug, global flag and permission keys', () => {
    const authUser = toAuthUser(baseUser);
    expect(authUser.role).toBe('pilot');
    expect(authUser.roleIsGlobal).toBe(false);
    expect(authUser.permissions).toEqual(['dashboard.read', 'audits.execute']);
    expect(authUser.id).toBe('u1');
  });
});

describe('toUserDto', () => {
  it('never exposes the password hash and serializes dates', () => {
    const dto = toUserDto(baseUser);
    expect(dto).not.toHaveProperty('passwordHash');
    expect(dto.roleSlug).toBe('pilot');
    expect(dto.departmentName).toBe('Production');
    expect(dto.createdAt).toBe('2025-01-01T00:00:00.000Z');
  });
});

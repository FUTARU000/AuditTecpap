import { describe, expect, it } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '@tecpap/types';
import { PermissionsGuard } from './permissions.guard';

function buildContext(user: AuthUser | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

function makeGuard(required: string[] | undefined): PermissionsGuard {
  return new PermissionsGuard({
    getAllAndOverride: () => required,
  } as never);
}

const admin: AuthUser = {
  id: 'u-admin',
  email: 'a@tecpap.local',
  role: 'administrator',
  roleIsGlobal: true,
  departmentId: null,
  permissions: ['users.read', 'users.create', 'roles.read'],
};

const pilot: AuthUser = {
  id: 'u-pilot',
  email: 'p@tecpap.local',
  role: 'pilot',
  roleIsGlobal: false,
  departmentId: 'd1',
  permissions: ['dashboard.read'],
};

describe('PermissionsGuard (DB-driven)', () => {
  it('allows when no permissions are required', () => {
    expect(makeGuard(undefined).canActivate(buildContext(pilot))).toBe(true);
    expect(makeGuard([]).canActivate(buildContext(pilot))).toBe(true);
  });

  it('allows when the principal holds every required key', () => {
    expect(makeGuard(['users.read', 'users.create']).canActivate(buildContext(admin))).toBe(true);
  });

  it('denies when a required key is missing', () => {
    expect(makeGuard(['users.read']).canActivate(buildContext(pilot))).toBe(false);
  });

  it('denies when there is no authenticated principal', () => {
    expect(makeGuard(['users.read']).canActivate(buildContext(undefined))).toBe(false);
  });

  it('does not hardcode any role bypass — only permission keys decide', () => {
    // A "pilot" with the right key passes; an "admin" without the key fails.
    const pilotWithKey: AuthUser = { ...pilot, permissions: ['users.read'] };
    expect(makeGuard(['users.read']).canActivate(buildContext(pilotWithKey))).toBe(true);
    const adminWithoutKey: AuthUser = { ...admin, permissions: [] };
    expect(makeGuard(['users.read']).canActivate(buildContext(adminWithoutKey))).toBe(false);
  });
});

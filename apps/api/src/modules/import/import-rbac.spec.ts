import { describe, expect, it } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '@tecpap/types';
import { SYSTEM_ROLES, SYSTEM_ROLE_SLUGS } from '@tecpap/config';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

/**
 * Regression coverage for Phase 6 (Google Drive import): adding a new import
 * *source* must not change who is allowed to start or review imports. Only
 * Administrator and Audit Manager (both global roles) may start/review
 * imports; Pilot (department-scoped) may only read them — this was already
 * true before Google Drive was wired in and must remain true after it,
 * since Drive reuses `imports.start`/`imports.review` unchanged.
 */

function roleUser(slug: string, isGlobal: boolean, departmentId: string | null): AuthUser {
  const role = SYSTEM_ROLES.find((r) => r.slug === slug);
  if (!role) throw new Error(`Unknown system role slug: ${slug}`);
  return { id: `u-${slug}`, email: `${slug}@tecpap.local`, role: slug, roleIsGlobal: isGlobal, departmentId, permissions: [...role.permissions] };
}

function buildContext(user: AuthUser): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

function makeGuard(required: string[]): PermissionsGuard {
  return new PermissionsGuard({ getAllAndOverride: () => required } as never);
}

const pilot = roleUser(SYSTEM_ROLE_SLUGS.PILOT, false, 'dept-production');
const manager = roleUser(SYSTEM_ROLE_SLUGS.AUDIT_MANAGER, true, null);
const admin = roleUser(SYSTEM_ROLE_SLUGS.ADMIN, true, null);

describe('Import RBAC — unchanged by adding Google Drive as a source (20)', () => {
  it('Pilot does not hold imports.start — cannot initiate any import, Drive included', () => {
    expect(pilot.permissions).not.toContain('imports.start');
    expect(makeGuard(['imports.start']).canActivate(buildContext(pilot))).toBe(false);
  });

  it('Pilot does not hold imports.review — cannot approve a Drive-imported item into a document', () => {
    expect(pilot.permissions).not.toContain('imports.review');
    expect(makeGuard(['imports.review']).canActivate(buildContext(pilot))).toBe(false);
  });

  it('Pilot retains imports.read only', () => {
    expect(pilot.permissions).toContain('imports.read');
  });

  it('Audit Manager retains imports.start and imports.review', () => {
    expect(manager.permissions).toContain('imports.start');
    expect(manager.permissions).toContain('imports.review');
    expect(makeGuard(['imports.start']).canActivate(buildContext(manager))).toBe(true);
  });

  it('Administrator retains imports.start and imports.review', () => {
    expect(admin.permissions).toContain('imports.start');
    expect(admin.permissions).toContain('imports.review');
  });

  it('no permission named after Google Drive was invented — the existing imports.* keys are reused as-is', () => {
    const driveSpecific = [...pilot.permissions, ...manager.permissions, ...admin.permissions].filter((p) => /drive/i.test(p));
    expect(driveSpecific).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '@tecpap/types';
import { SYSTEM_ROLES, SYSTEM_ROLE_SLUGS } from '@tecpap/config';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

/**
 * Regression coverage for Phase 3: introducing CAPA verification history must
 * not change who is allowed to verify. Audit Manager verifies; Pilots do not
 * — this was already true before Phase 3 and must remain true after it.
 */

function roleUser(slug: string, isGlobal: boolean, departmentId: string | null): AuthUser {
  const role = SYSTEM_ROLES.find((r) => r.slug === slug);
  if (!role) throw new Error(`Unknown system role slug: ${slug}`);
  return {
    id: `u-${slug}`,
    email: `${slug}@tecpap.local`,
    role: slug,
    roleIsGlobal: isGlobal,
    departmentId,
    permissions: [...role.permissions],
  };
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

describe('CAPA verify RBAC — unchanged by Phase 3 (verification history)', () => {
  it('Pilot does not hold capas.verify', () => {
    expect(pilot.permissions).not.toContain('capas.verify');
    expect(makeGuard(['capas.verify']).canActivate(buildContext(pilot))).toBe(false);
  });

  it('Audit Manager retains capas.verify', () => {
    expect(manager.permissions).toContain('capas.verify');
    expect(makeGuard(['capas.verify']).canActivate(buildContext(manager))).toBe(true);
  });

  it('Pilot retains capas.submit and capas.rework (unaffected by the verification history change)', () => {
    expect(pilot.permissions).toContain('capas.submit');
    expect(pilot.permissions).toContain('capas.rework');
  });
});

/**
 * Individual per-action verification (POST /capas/:id/actions/:actionId/verify)
 * intentionally reuses the exact same `capas.verify` permission as the general
 * CAPA verification, rather than introducing a new key — same authority tier,
 * same guard. This locks in that a Pilot cannot reach it and a Manager can.
 */
describe('CAPA individual action verification RBAC (reuses capas.verify — no new permission introduced)', () => {
  it('Pilot cannot verify/pass/fail individual actions', () => {
    expect(pilot.permissions).not.toContain('capas.verify');
    expect(makeGuard(['capas.verify']).canActivate(buildContext(pilot))).toBe(false);
  });

  it('Audit Manager can verify/pass/fail individual actions', () => {
    expect(manager.permissions).toContain('capas.verify');
    expect(makeGuard(['capas.verify']).canActivate(buildContext(manager))).toBe(true);
  });
});

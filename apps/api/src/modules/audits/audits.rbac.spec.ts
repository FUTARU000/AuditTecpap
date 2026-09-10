import { describe, expect, it } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '@tecpap/types';
import { SYSTEM_ROLES, SYSTEM_ROLE_SLUGS } from '@tecpap/config';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

/**
 * Regression coverage for the TECPAP business rule "Pilots do NOT perform
 * audits — the Audit Manager performs internal audits." This exercises the
 * REAL @tecpap/config role definitions (not a hand-copied permission list),
 * so a future accidental re-grant of audits.create/execute/submit to Pilot
 * fails this test immediately.
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

describe('Audit RBAC — Pilots do NOT perform audits (TECPAP business rule)', () => {
  it('Pilot permission set does not grant audit creation/execution/submission', () => {
    expect(pilot.permissions).not.toContain('audits.create');
    expect(pilot.permissions).not.toContain('audits.execute');
    expect(pilot.permissions).not.toContain('audits.submit');
  });

  it('Pilot cannot create an audit', () => {
    expect(makeGuard(['audits.create']).canActivate(buildContext(pilot))).toBe(false);
  });

  it('Pilot cannot start/execute an audit', () => {
    expect(makeGuard(['audits.execute']).canActivate(buildContext(pilot))).toBe(false);
  });

  it('Pilot cannot answer questions on an audit (also gated by audits.execute)', () => {
    expect(makeGuard(['audits.execute']).canActivate(buildContext(pilot))).toBe(false);
  });

  it('Pilot cannot submit an audit', () => {
    expect(makeGuard(['audits.submit']).canActivate(buildContext(pilot))).toBe(false);
  });

  it('Pilot retains legitimate read access to audits', () => {
    expect(pilot.permissions).toContain('audits.read');
    expect(makeGuard(['audits.read']).canActivate(buildContext(pilot))).toBe(true);
  });

  it('Audit Manager retains audit creation/execution/submission/approval', () => {
    expect(manager.permissions).toEqual(
      expect.arrayContaining(['audits.create', 'audits.execute', 'audits.submit', 'audits.approve']),
    );
    expect(makeGuard(['audits.create']).canActivate(buildContext(manager))).toBe(true);
    expect(makeGuard(['audits.execute']).canActivate(buildContext(manager))).toBe(true);
    expect(makeGuard(['audits.submit']).canActivate(buildContext(manager))).toBe(true);
    expect(makeGuard(['audits.approve']).canActivate(buildContext(manager))).toBe(true);
  });
});

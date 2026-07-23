import { describe, expect, it } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '@tecpap/types';
import { DepartmentScopeGuard } from './department-scope.guard';

function buildContext(user: AuthUser | undefined): ExecutionContext {
  const request: Record<string, unknown> = { user };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('DepartmentScopeGuard', () => {
  it('marks global roles as global and never blocks', () => {
    const ctx = buildContext({
      id: '1',
      email: 'a@b.c',
      role: 'audit-manager',
      roleIsGlobal: true,
      departmentId: null,
      permissions: [],
    });
    expect(new DepartmentScopeGuard().canActivate(ctx)).toBe(true);
    const request = ctx.switchToHttp().getRequest<{ dataScope: { isGlobal: boolean } }>();
    expect(request.dataScope.isGlobal).toBe(true);
  });

  it('scopes non-global roles to their department', () => {
    const ctx = buildContext({
      id: '2',
      email: 'p@b.c',
      role: 'pilot',
      roleIsGlobal: false,
      departmentId: 'dept-1',
      permissions: [],
    });
    new DepartmentScopeGuard().canActivate(ctx);
    const request = ctx.switchToHttp().getRequest<{ dataScope: { departmentId: string | null; isGlobal: boolean } }>();
    expect(request.dataScope).toEqual({ role: 'pilot', departmentId: 'dept-1', isGlobal: false });
  });

  it('does nothing when unauthenticated', () => {
    const ctx = buildContext(undefined);
    expect(new DepartmentScopeGuard().canActivate(ctx)).toBe(true);
  });
});

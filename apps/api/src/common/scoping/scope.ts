import type { Prisma } from '@prisma/client';
import type { DataScope } from '../types/data-scope';

/**
 * Apply department data-scoping to a Prisma `where` clause.
 *
 * Global principals (Administrator, Audit Manager — `scope.isGlobal === true`)
 * get no extra filter. Department-scoped principals (Pilots, custom non-global
 * roles) are restricted to their own department. Pass this into every list/find
 * query so scoping is structural, not optional.
 *
 * @example
 * prisma.user.findMany({ where: { deletedAt: null, ...departmentScopeWhere(req.dataScope, { status: 'ACTIVE' }) } })
 */
export function departmentScopeWhere(
  scope: DataScope | undefined,
  base: Prisma.UserWhereInput | Prisma.DepartmentWhereInput | Record<string, unknown> = {},
): Record<string, unknown> {
  if (!scope || scope.isGlobal) {
    return { ...(base as Record<string, unknown>) };
  }
  return {
    ...(base as Record<string, unknown>),
    departmentId: scope.departmentId,
  };
}

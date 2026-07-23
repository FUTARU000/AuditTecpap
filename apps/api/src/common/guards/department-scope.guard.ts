import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { AuthUser } from '@tecpap/types';
import type { DataScope } from '../types/data-scope';

/**
 * Resolves the request's DataScope and attaches it as `req.dataScope`.
 * Never blocks — actual isolation is enforced in the repository layer via the
 * `departmentScopeWhere` helper, so a Pilot can never read another department's
 * data even if a permission check is missed (defence-in-depth, SAD §17.2).
 */
@Injectable()
export class DepartmentScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      user?: AuthUser;
      dataScope?: DataScope;
    }>();
    const user = request.user;
    if (!user) {
      return true;
    }
    request.dataScope = {
      role: user.role,
      departmentId: user.departmentId,
      isGlobal: user.roleIsGlobal,
    };
    return true;
  }
}

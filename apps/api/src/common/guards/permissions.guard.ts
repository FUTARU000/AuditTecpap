import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthUser } from '@tecpap/types';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

/**
 * DB-driven permission enforcement.
 *
 * The guard is generic — it NEVER hardcodes permission lists. It reads the
 * required keys from the @Permissions() decorator and checks them against the
 * principal's effective permission set, which is loaded fresh from the database
 * in the JWT strategy (so role/permission changes take effect immediately).
 *
 * A role with every permission (e.g. Administrator) passes trivially.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }
    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = request.user;
    if (!user) {
      return false;
    }
    return required.every((permission) => user.permissions.includes(permission));
  }
}

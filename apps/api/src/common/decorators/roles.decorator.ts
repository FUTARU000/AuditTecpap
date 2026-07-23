import { SetMetadata } from '@nestjs/common';
import type { Role } from '@tecpap/types';

export const ROLES_KEY = 'roles';

/** Restricts a route to the given roles. Pair with RolesGuard. */
export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);

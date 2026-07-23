import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '@tecpap/types';

/** Injects the authenticated principal (or one of its fields) from req.user. */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext): AuthUser | unknown => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);

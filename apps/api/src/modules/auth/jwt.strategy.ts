import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthUser, JwtPayload } from '@tecpap/types';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Validates bearer access tokens and exposes the authenticated principal as
 * `req.user`. Permissions are loaded fresh from the database on every request,
 * so role/permission/status changes take effect immediately and disabled or
 * soft-deleted users are rejected (session invalidation).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser | false> {
    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null, status: 'ACTIVE' },
      include: {
        role: { include: { permissions: { select: { key: true } } } },
      },
    });
    if (!user) {
      return false;
    }
    return {
      id: user.id,
      email: user.email,
      role: user.role.slug,
      roleIsGlobal: user.role.isGlobal,
      departmentId: user.departmentId,
      permissions: user.role.permissions.map((permission) => permission.key),
    };
  }
}

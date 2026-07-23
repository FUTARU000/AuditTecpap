import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import {
  AUDIT_ACTIONS,
  type AuthUser,
  type ChangePasswordDto,
  type JwtPayload,
  type LoginDto,
  type TokenPair,
  type UserDto,
} from '@tecpap/types';
import { toAuthUser, toUserDto, type UserWithRelations } from '../../common/mappers/user.mapper';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { hashPassword, verifyPassword } from './utils/password';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const RESET_TTL_MS = 60 * 60 * 1000;

interface AuditActor {
  actorId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

/**
 * Authentication: credential validation, token issuance with refresh-token
 * rotation + revocation, password reset, and audit logging of auth events.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  // ---------------------------------------------------------------- auth flow

  async login(dto: LoginDto, actor: Omit<AuditActor, 'actorId'>): Promise<TokenPair & { user: UserDto }> {
    const user = await this.findAuthUserByEmail(dto.email);

    if (!user || user.deletedAt) {
      await this.auditLog.record({ ...actor, actorId: null, ...this.failedEvent(dto.email) });
      throw new UnauthorizedException('Invalid email or password');
    }
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active. Contact an administrator.');
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Account is temporarily locked. Try again later.');
    }

    const valid = await verifyPassword(dto.password, user.passwordHash);
    if (!valid) {
      await this.registerFailedAttempt(user);
      await this.auditLog.record({
        ...actor,
        actorId: user.id,
        action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED,
        entityType: 'user',
        entityId: user.id,
        target: user.email,
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    const authUser = toAuthUser(user);
    const tokens = await this.issueTokens(authUser);
    await this.auditLog.record({
      ...actor,
      actorId: user.id,
      action: AUDIT_ACTIONS.AUTH_LOGIN,
      entityType: 'user',
      entityId: user.id,
      target: user.email,
    });
    return { ...tokens, user: toUserDto(user) };
  }

  async refresh(refreshToken: string, actor: Omit<AuditActor, 'actorId'>): Promise<TokenPair> {
    const record = await this.verifyRefreshToken(refreshToken);
    if (!record) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    const user = await this.findAuthUserById(record.userId);
    if (!user || user.deletedAt || user.status !== 'ACTIVE') {
      await this.revokeRefreshTokenRecord(record.id);
      throw new UnauthorizedException('Account is no longer active');
    }
    const nextRefresh = await this.createRefreshToken(user.id);
    await this.revokeRefreshTokenRecord(record.id);

    const tokens = await this.issueTokens(toAuthUser(user), nextRefresh);
    await this.auditLog.record({
      ...actor,
      actorId: user.id,
      action: AUDIT_ACTIONS.AUTH_REFRESH,
      entityType: 'user',
      entityId: user.id,
      target: user.email,
    });
    return tokens;
  }

  async logout(refreshToken: string, actor: AuditActor): Promise<void> {
    const record = await this.verifyRefreshToken(refreshToken);
    if (record) {
      await this.revokeRefreshTokenRecord(record.id);
      await this.auditLog.record({
        ...actor,
        action: AUDIT_ACTIONS.AUTH_LOGOUT,
        entityType: 'user',
        entityId: record.userId,
      });
    }
  }

  async me(authUser: AuthUser): Promise<UserDto> {
    const user = await this.findAuthUserById(authUser.id);
    if (!user) {
      throw new UnauthorizedException();
    }
    return toUserDto(user);
  }

  // ------------------------------------------------------------- password mgmt

  async changePassword(authUser: AuthUser, dto: ChangePasswordDto, actor: AuditActor): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: authUser.id } });
    if (!user || !(await verifyPassword(dto.currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(dto.newPassword) },
    });
    await this.auditLog.record({
      ...actor,
      action: AUDIT_ACTIONS.USER_PASSWORD_CHANGE,
      entityType: 'user',
      entityId: user.id,
      target: user.email,
    });
  }

  /** Generate a one-time reset token for a user (admin reset or self-service request). */
  async generateResetToken(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      return null;
    }
    const token = randomBytes(32).toString('base64url');
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordResetToken: this.hashToken(token),
        passwordResetExpiresAt: new Date(Date.now() + RESET_TTL_MS),
      },
    });
    return token;
  }

  /** Self-service variant: look the user up by email. Never reveals whether the email exists. */
  async generateResetTokenByEmail(email: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || user.deletedAt) {
      return null;
    }
    return this.generateResetToken(user.id);
  }

  async resetPassword(token: string, newPassword: string, actor: Omit<AuditActor, 'actorId'>): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { passwordResetToken: this.hashToken(token), deletedAt: null },
    });
    if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired password reset token');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(newPassword),
        passwordResetToken: null,
        passwordResetExpiresAt: null,
      },
    });
    // Invalidate all existing sessions — the user must sign in with the new password.
    await this.revokeAllForUser(user.id);
    await this.auditLog.record({
      ...actor,
      actorId: user.id,
      action: AUDIT_ACTIONS.USER_PASSWORD_RESET,
      entityType: 'user',
      entityId: user.id,
      target: user.email,
    });
  }

  // --------------------------------------------------------------- token infra

  async issueTokens(user: AuthUser, explicitRefresh?: string): Promise<TokenPair> {
    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: user.id,
      email: user.email,
      role: user.role,
      roleIsGlobal: user.roleIsGlobal,
      departmentId: user.departmentId,
      permissions: user.permissions,
    };
    const accessTtl = this.config.get<number>('JWT_ACCESS_TTL') ?? 900;
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: accessTtl,
    });
    const refreshToken = explicitRefresh ?? (await this.createRefreshToken(user.id));
    return { accessToken, refreshToken, expiresIn: accessTtl };
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ----------------------------------------------------------------- internals

  private async verifyRefreshToken(token: string) {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hashToken(token) },
    });
    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      return null;
    }
    return record;
  }

  private async revokeRefreshTokenRecord(id: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  private async createRefreshToken(userId: string): Promise<string> {
    const token = randomBytes(48).toString('base64url');
    const ttlSeconds = this.config.get<number>('JWT_REFRESH_TTL') ?? 604800;
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(token),
        expiresAt: new Date(Date.now() + ttlSeconds * 1000),
      },
    });
    return token;
  }

  private async registerFailedAttempt(user: UserWithRelations): Promise<void> {
    const failed = user.failedLoginCount + 1;
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: failed,
        ...(failed >= MAX_FAILED_ATTEMPTS
          ? { lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) }
          : {}),
      },
    });
  }

  private async findAuthUserByEmail(email: string): Promise<UserWithRelations | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        role: { include: { permissions: { select: { key: true } } } },
        department: { select: { id: true, name: true } },
      },
    });
  }

  private async findAuthUserById(id: string): Promise<UserWithRelations | null> {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: {
        role: { include: { permissions: { select: { key: true } } } },
        department: { select: { id: true, name: true } },
      },
    });
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private failedEvent(email: string) {
    return {
      action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED,
      entityType: 'user',
      target: email,
    };
  }
}

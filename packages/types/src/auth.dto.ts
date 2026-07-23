import type { Role } from './enums';

/** Login request. */
export interface LoginDto {
  email: string;
  password: string;
}

/** Issued token pair. */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/** Refresh token request. */
export interface RefreshDto {
  refreshToken: string;
}

/** Password reset request body (consuming a reset token). */
export interface PasswordResetDto {
  token: string;
  newPassword: string;
}

/** Authenticated principal, embedded in the JWT and request context. */
export interface AuthUser {
  id: string;
  email: string;
  /** Role slug (e.g. 'administrator'). Custom roles are dynamic. */
  role: Role;
  /** True for roles that bypass department data-scoping. */
  roleIsGlobal: boolean;
  departmentId: string | null;
  /** Effective permission keys, loaded from the DB at auth time. */
  permissions: string[];
}

/** Decoded access-token payload. */
export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  roleIsGlobal: boolean;
  departmentId: string | null;
  permissions: string[];
  iat?: number;
  exp?: number;
}

import type { Role } from '@tecpap/types';

/**
 * Resolved authorization scope, attached to the request as `req.dataScope`.
 * Repositories apply it as a mandatory `where` filter so a Pilot can never read
 * another department's data (defence-in-depth — SAD §11, §17.2).
 */
export interface DataScope {
  role: Role;
  departmentId: string | null;
  /** true for ADMIN/AUDIT_MANAGER (cross-department visibility). */
  isGlobal: boolean;
}

declare module 'express' {
  interface Request {
    user?: import('@tecpap/types').AuthUser;
    dataScope?: DataScope;
  }
}

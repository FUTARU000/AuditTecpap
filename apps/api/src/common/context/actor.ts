import type { Request } from 'express';
import type { AuthUser } from '@tecpap/types';

/** Caller context captured for audit logging. */
export interface ActorContext {
  actorId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

/**
 * Extract the actor context (id, ip, user-agent) from an Express request.
 * Headers are cast to a plain record because Express 5's `Headers` type lacks
 * the string index signature we need for lookups.
 */
export function actorFromRequest(req: Request): ActorContext {
  const headers = req.headers as unknown as Record<string, string | string[] | undefined>;
  const forwarded = headers['x-forwarded-for'];
  const forwardedIp = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]?.trim();
  const ip = req.ip ?? req.ips?.[0] ?? forwardedIp ?? null;
  const userAgent = headers['user-agent'] ?? null;
  return {
    actorId: req.user?.id ?? null,
    ipAddress: ip ? String(ip) : null,
    userAgent: userAgent ? String(userAgent) : null,
  };
}

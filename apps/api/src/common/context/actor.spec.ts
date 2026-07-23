import { describe, expect, it } from 'vitest';
import { actorFromRequest } from './actor';

describe('actorFromRequest', () => {
  it('extracts actor id, ip and user agent', () => {
    const req = {
      user: { id: 'u1', email: 'a@b.c', role: 'administrator', roleIsGlobal: true, departmentId: null, permissions: [] },
      ip: '10.0.0.1',
      headers: { 'user-agent': 'Mozilla/5.0' },
    };
    expect(actorFromRequest(req as never)).toEqual({
      actorId: 'u1',
      ipAddress: '10.0.0.1',
      userAgent: 'Mozilla/5.0',
    });
  });

  it('falls back to x-forwarded-for when ip is missing', () => {
    const req = {
      user: { id: 'u2', email: 'b@b.c', role: 'pilot', roleIsGlobal: false, departmentId: 'd1', permissions: [] },
      headers: { 'x-forwarded-for': '203.0.113.7, 198.51.100.2', 'user-agent': 'curl/8' },
    };
    expect(actorFromRequest(req as never).ipAddress).toBe('203.0.113.7');
  });

  it('nulls out missing fields', () => {
    expect(actorFromRequest({ headers: {} } as never)).toEqual({
      actorId: null,
      ipAddress: null,
      userAgent: null,
    });
  });
});

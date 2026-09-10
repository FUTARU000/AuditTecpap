import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, clearTokens, getAccessToken, getRefreshToken, invalidateSession, setTokens } from './api';

/**
 * Phase 2 — silent refresh flow. These tests exercise `lib/api.ts` directly,
 * which is where every authenticated frontend request is centralized
 * (`api.get/post/patch/delete` and `uploadFile` all funnel through it).
 */

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function unauthorizedResponse(): Response {
  return jsonResponse(401, { error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
}

beforeEach(() => {
  window.localStorage.clear();
  // jsdom doesn't implement real navigation; stub `location` with a plain,
  // freely-mutable object so `handleAuthFailure()`'s redirect can be
  // asserted on without triggering jsdom's "Not implemented: navigation".
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { pathname: '/dashboard', href: 'http://localhost:3000/dashboard' },
  });
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('login / token storage', () => {
  it('stores the access and refresh tokens returned by /auth/login', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(200, { accessToken: 'access-1', refreshToken: 'refresh-1', user: { id: 'u1' } }),
    );
    const result = await api.post<{ accessToken: string; refreshToken: string }>('/auth/login', { email: 'a@b.c', password: 'password123' });
    setTokens(result.accessToken, result.refreshToken);
    expect(getAccessToken()).toBe('access-1');
    expect(getRefreshToken()).toBe('refresh-1');
  });

  it('does not attempt a refresh on a 401 from /auth/login itself (bad credentials)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(401, { error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' } }));
    await expect(api.post('/auth/login', { email: 'a@b.c', password: 'wrong' })).rejects.toThrow('Invalid email or password');
    expect(fetch).toHaveBeenCalledTimes(1); // no refresh call attempted
  });
});

describe('normal authenticated request', () => {
  it('sends the stored access token and does not call refresh when the response is not 401', async () => {
    setTokens('access-1', 'refresh-1');
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    const result = await api.get<{ ok: boolean }>('/audits');
    expect(result).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer access-1');
  });
});

describe('expired access token → silent refresh → retry', () => {
  it('refreshes once and retries the original request on a single 401', async () => {
    setTokens('expired-access', 'refresh-1');
    vi.mocked(fetch)
      .mockResolvedValueOnce(unauthorizedResponse()) // original request: expired
      .mockResolvedValueOnce(jsonResponse(200, { accessToken: 'new-access', refreshToken: 'new-refresh', expiresIn: 900 })) // refresh
      .mockResolvedValueOnce(jsonResponse(200, { data: 'ok' })); // retried request

    const result = await api.get<{ data: string }>('/audits');

    expect(result).toEqual({ data: 'ok' });
    expect(fetch).toHaveBeenCalledTimes(3);

    // Call 2 must be the refresh call, carrying the CURRENT (pre-rotation) refresh token.
    const refreshCall = vi.mocked(fetch).mock.calls[1]!;
    expect(String(refreshCall[0])).toContain('/auth/refresh');
    expect(JSON.parse(String(refreshCall[1]?.body))).toEqual({ refreshToken: 'refresh-1' });

    // Call 3 (the retry) must carry the NEW access token.
    const retryCall = vi.mocked(fetch).mock.calls[2]!;
    expect((retryCall[1]?.headers as Record<string, string>).Authorization).toBe('Bearer new-access');
  });

  it('stores the rotated refresh token, not the old one, after a successful refresh', async () => {
    setTokens('expired-access', 'old-refresh');
    vi.mocked(fetch)
      .mockResolvedValueOnce(unauthorizedResponse())
      .mockResolvedValueOnce(jsonResponse(200, { accessToken: 'new-access', refreshToken: 'rotated-refresh', expiresIn: 900 }))
      .mockResolvedValueOnce(jsonResponse(200, { data: 'ok' }));

    await api.get('/audits');

    expect(getAccessToken()).toBe('new-access');
    expect(getRefreshToken()).toBe('rotated-refresh');
    expect(getRefreshToken()).not.toBe('old-refresh');
  });
});

describe('retry limit — a 401 from the retried request is final', () => {
  it('does not attempt a second refresh when the retried request also 401s', async () => {
    setTokens('expired-access', 'refresh-1');
    vi.mocked(fetch)
      .mockResolvedValueOnce(unauthorizedResponse()) // original
      .mockResolvedValueOnce(jsonResponse(200, { accessToken: 'new-access', refreshToken: 'new-refresh', expiresIn: 900 })) // refresh
      .mockResolvedValueOnce(unauthorizedResponse()); // retry ALSO fails

    await expect(api.get('/audits')).rejects.toThrow();

    // original + refresh + one retry = 3 calls. No second refresh, no third attempt.
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(getAccessToken()).toBeNull(); // session was cleared, not looped
  });
});

describe('refresh failure', () => {
  it('clears tokens and redirects to /login when the refresh token is rejected', async () => {
    setTokens('expired-access', 'invalid-refresh');
    vi.mocked(fetch)
      .mockResolvedValueOnce(unauthorizedResponse()) // original request expired
      .mockResolvedValueOnce(unauthorizedResponse()); // refresh itself rejected

    await expect(api.get('/audits')).rejects.toThrow();

    expect(fetch).toHaveBeenCalledTimes(2); // original + refresh attempt — no retry, since refresh failed
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(window.location.href).toBe('/login');
  });

  it('does not call refresh at all when there is no refresh token to use', async () => {
    setTokens('expired-access', '');
    window.localStorage.removeItem('tecpap.refresh');
    vi.mocked(fetch).mockResolvedValueOnce(unauthorizedResponse());

    await expect(api.get('/audits')).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1); // no refresh call was possible
  });
});

describe('concurrent 401s (refresh stampede)', () => {
  it('sends exactly one refresh request for multiple simultaneous 401s, and both requests recover', async () => {
    setTokens('expired-access', 'refresh-1');

    let refreshCalls = 0;
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/auth/refresh')) {
        refreshCalls += 1;
        return Promise.resolve(jsonResponse(200, { accessToken: 'new-access', refreshToken: 'new-refresh', expiresIn: 900 }));
      }
      const authHeader = (init?.headers as Record<string, string> | undefined)?.Authorization;
      if (authHeader === 'Bearer new-access') {
        return Promise.resolve(jsonResponse(200, { data: url }));
      }
      return Promise.resolve(unauthorizedResponse());
    });

    const [resultA, resultB] = await Promise.all([
      api.get<{ data: string }>('/audits'),
      api.get<{ data: string }>('/capas'),
    ]);

    expect(refreshCalls).toBe(1); // stampede protection: only one refresh call total
    expect(resultA.data).toContain('/audits');
    expect(resultB.data).toContain('/capas');
    expect(getAccessToken()).toBe('new-access');
  });

  it('fails all waiting requests cleanly (no loop) when the shared refresh fails', async () => {
    setTokens('expired-access', 'invalid-refresh');

    let refreshCalls = 0;
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/auth/refresh')) {
        refreshCalls += 1;
        return Promise.resolve(unauthorizedResponse());
      }
      return Promise.resolve(unauthorizedResponse());
    });

    const [resultA, resultB] = await Promise.allSettled([api.get('/audits'), api.get('/capas')]);

    expect(refreshCalls).toBe(1); // exactly one refresh attempt for both waiters
    expect(resultA.status).toBe('rejected');
    expect(resultB.status).toBe('rejected');
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });
});

describe('logout', () => {
  it('discards a refresh that resolves after logout instead of resurrecting the session', async () => {
    setTokens('expired-access', 'refresh-1');

    let resolveRefresh!: (value: Response) => void;
    let markRefreshStarted!: () => void;
    const refreshStarted = new Promise<void>((resolve) => {
      markRefreshStarted = resolve;
    });
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/auth/refresh')) {
        markRefreshStarted();
        return new Promise<Response>((resolve) => {
          resolveRefresh = resolve;
        });
      }
      return Promise.resolve(unauthorizedResponse());
    });

    // Fire a request that will trigger a refresh, but don't await it yet.
    const pending = api.get('/audits').catch(() => 'failed-as-expected');

    // Wait until the refresh call has actually started (epochAtStart captured
    // before the logout below) before invalidating — this is the exact race
    // the implementation must win: logout arriving mid-refresh.
    await refreshStarted;
    invalidateSession();
    clearTokens();

    // Now the stale refresh finally resolves with tokens.
    resolveRefresh(jsonResponse(200, { accessToken: 'resurrected-access', refreshToken: 'resurrected-refresh', expiresIn: 900 }));
    await pending;

    // The logout must win: no resurrected session in storage.
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it('logout call itself succeeds with a valid session', async () => {
    setTokens('access-1', 'refresh-1');
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(200, {}));
    await expect(api.post('/auth/logout', { refreshToken: 'refresh-1' })).resolves.toEqual({});
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

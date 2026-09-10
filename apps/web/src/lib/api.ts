import type { ApiError } from '@tecpap/types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const API_PREFIX = '/api/v1';
const ACCESS_KEY = 'tecpap.access';
const REFRESH_KEY = 'tecpap.refresh';

const isBrowser = typeof window !== 'undefined';

export function getAccessToken(): string | null {
  return isBrowser ? window.localStorage.getItem(ACCESS_KEY) : null;
}
export function getRefreshToken(): string | null {
  return isBrowser ? window.localStorage.getItem(REFRESH_KEY) : null;
}
export function setTokens(accessToken: string, refreshToken: string): void {
  if (!isBrowser) return;
  window.localStorage.setItem(ACCESS_KEY, accessToken);
  window.localStorage.setItem(REFRESH_KEY, refreshToken);
}
export function clearTokens(): void {
  if (!isBrowser) return;
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
}

export class RequestError extends Error {
  code: string;
  status: number;
  details?: Array<{ field: string; issue: string }>;
  constructor(message: string, status: number, error?: ApiError['error']) {
    super(message);
    this.code = error?.code ?? 'ERROR';
    this.status = status;
    this.details = error?.details;
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  query?: Record<string, string | number | undefined | null>;
}

/** Endpoints that must never trigger the refresh/retry dance on a 401 of their own. */
const AUTH_ENDPOINTS = new Set(['/auth/login', '/auth/refresh']);

function handleAuthFailure(): void {
  clearTokens();
  if (isBrowser && !window.location.pathname.startsWith('/login')) {
    window.location.href = '/login';
  }
}

let refreshPromise: Promise<string | null> | null = null;
/** Bumped on logout so a refresh already in flight can't resurrect a session afterwards. */
let sessionEpoch = 0;

/** Call on logout: discards the effect of any refresh that resolves after this point. */
export function invalidateSession(): void {
  sessionEpoch += 1;
}

/**
 * Raw refresh call — deliberately bypasses `request()` so it can never
 * re-enter the 401/retry logic below (the refresh endpoint is public and
 * carries no Authorization header of its own).
 */
async function performRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  const epochAtStart = sessionEpoch;
  try {
    const response = await fetch(new URL(`${API_PREFIX}/auth/refresh`, BASE_URL).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { accessToken: string; refreshToken: string; expiresIn: number };
    if (sessionEpoch !== epochAtStart) return null; // logged out while this refresh was in flight
    setTokens(data.accessToken, data.refreshToken);
    return data.accessToken;
  } catch {
    return null;
  }
}

/**
 * Shared refresh mutex. Every 401 handler calls this; the first caller starts
 * the refresh and every concurrent caller awaits the SAME promise instead of
 * firing its own request — required both to avoid a refresh stampede and
 * because the backend rotates (single-uses) the refresh token, so a second
 * concurrent call with the same token would fail.
 */
function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function request<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const { body, query, headers, ...rest } = options;
  const url = new URL(`${API_PREFIX}${path}`, BASE_URL);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const requestHeaders: Record<string, string> = { 'Content-Type': 'application/json', ...(headers as Record<string, string>) };
  const access = getAccessToken();
  if (access) {
    requestHeaders.Authorization = `Bearer ${access}`;
  }

  const response = await fetch(url.toString(), {
    ...rest,
    headers: requestHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 && !AUTH_ENDPOINTS.has(path)) {
    if (!isRetry) {
      const refreshedToken = await refreshAccessToken();
      if (refreshedToken) {
        return request<T>(path, options, true);
      }
    }
    // Either this was already a retry, or no refresh was possible — final failure.
    handleAuthFailure();
  }

  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    const error = (data as ApiError | null)?.error;
    throw new RequestError(error?.message ?? 'Request failed', response.status, error);
  }

  return data as T;
}

export const api = {
  get: <T>(path: string, query?: RequestOptions['query']) => request<T>(path, { query }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

/** Upload multipart form data (e.g. a document file). */
export async function uploadFile<T>(path: string, formData: FormData, isRetry = false): Promise<T> {
  const url = new URL(`${API_PREFIX}${path}`, BASE_URL);
  const headers: Record<string, string> = {};
  const access = getAccessToken();
  if (access) {
    headers.Authorization = `Bearer ${access}`;
  }
  const response = await fetch(url.toString(), { method: 'POST', headers, body: formData });

  if (response.status === 401) {
    if (!isRetry) {
      const refreshedToken = await refreshAccessToken();
      if (refreshedToken) {
        return uploadFile<T>(path, formData, true);
      }
    }
    handleAuthFailure();
  }

  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!response.ok) {
    const error = (data as ApiError | null)?.error;
    throw new RequestError(error?.message ?? 'Upload failed', response.status, error);
  }
  return data as T;
}

/** Build a query string from a record (used by table filters). */
export function toQuery(params: Record<string, string | number | undefined | null>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      result[key] = String(value);
    }
  }
  return result;
}

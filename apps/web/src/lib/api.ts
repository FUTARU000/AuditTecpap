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

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
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

  if (response.status === 401) {
    clearTokens();
    if (isBrowser && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
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

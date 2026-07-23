'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { LoginDto, UserDto } from '@tecpap/types';
import { api, clearTokens, getAccessToken, getRefreshToken, setTokens } from '@/lib/api';

interface AuthState {
  user: UserDto | null;
  permissions: string[];
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (dto: LoginDto) => Promise<UserDto>;
  logout: () => Promise<void>;
  hasPermission: (key: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface JwtPayload {
  permissions?: string[];
  role?: string;
}

function decodePermissions(token: string): string[] {
  try {
    const payload = token.split('.')[1] ?? '';
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as JwtPayload;
    return decoded.permissions ?? [];
  } catch {
    return [];
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, permissions: [], loading: true });

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setState({ user: null, permissions: [], loading: false });
      return;
    }
    const permissions = decodePermissions(token);
    api
      .get<UserDto>('/auth/me')
      .then((user) => setState({ user, permissions, loading: false }))
      .catch(() => setState({ user: null, permissions: [], loading: false }));
  }, []);

  const login = useCallback(async (dto: LoginDto): Promise<UserDto> => {
    const result = await api.post<{ accessToken: string; refreshToken: string; user: UserDto }>('/auth/login', dto);
    setTokens(result.accessToken, result.refreshToken);
    setState({ user: result.user, permissions: decodePermissions(result.accessToken), loading: false });
    return result.user;
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      await api.post('/auth/logout', { refreshToken }).catch(() => undefined);
    }
    clearTokens();
    setState({ user: null, permissions: [], loading: false });
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }, []);

  const hasPermission = useCallback(
    (key: string) => state.permissions.includes(key),
    [state.permissions],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, logout, hasPermission }),
    [state, login, logout, hasPermission],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { API_BASE_URL, ApiError, apiFetch } from '@/lib/api';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
}

interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  accessTokenExpiresIn: number;
}

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Authenticated fetch: attaches the access token, retries once via silent refresh on 401. */
  authFetch: <T>(path: string, init?: RequestInit) => Promise<T>;
  /**
   * Same auth/refresh handling as authFetch, but returns the raw Response
   * instead of parsing it as JSON - for endpoints that stream a body (e.g.
   * Server-Sent Events) rather than returning one JSON object.
   */
  authFetchStream: (path: string, init?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Access tokens are short-lived and only ever kept in memory - never
  // localStorage/sessionStorage, so they can't be read by injected/XSS'd
  // script via storage APIs. The long-lived refresh token stays in the
  // httpOnly cookie the backend already sets (Step 2) and this component
  // never touches it directly.
  const accessTokenRef = useRef<string | null>(null);

  const applySession = useCallback((res: AuthResponse) => {
    accessTokenRef.current = res.accessToken;
    setUser(res.user);
    setStatus('authenticated');
  }, []);

  const clearSession = useCallback(() => {
    accessTokenRef.current = null;
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const refresh = useCallback(async (): Promise<boolean> => {
    try {
      const res = await apiFetch<AuthResponse>('/auth/refresh', { method: 'POST' });
      applySession(res);
      return true;
    } catch {
      clearSession();
      return false;
    }
  }, [applySession, clearSession]);

  // Guards against React Strict Mode's dev-only double-invocation of mount
  // effects: without this, two near-simultaneous /auth/refresh calls both
  // read the same refresh-token cookie, the first rotates it, and the
  // second gets flagged as reuse of a now-stale token - which the backend
  // (correctly, in general) treats as a possible compromise and revokes the
  // whole session, silently bouncing an otherwise-successful login back to
  // signed-out. A ref (not state) survives Strict Mode's synthetic
  // unmount/remount, so the guard holds across both invocations.
  const hasBootstrapped = useRef(false);
  useEffect(() => {
    if (hasBootstrapped.current) return;
    hasBootstrapped.current = true;
    // Only on mount: restore a session from the refresh cookie, if any. The
    // resulting setState happens asynchronously after the network request
    // resolves, not synchronously within the effect body.
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      setError(null);
      try {
        const res = await apiFetch<AuthResponse>('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        applySession(res);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Could not sign in.');
        throw e;
      }
    },
    [applySession],
  );

  const register = useCallback(
    async (email: string, password: string, displayName: string) => {
      setError(null);
      try {
        const res = await apiFetch<AuthResponse>('/auth/register', {
          method: 'POST',
          body: JSON.stringify({ email, password, displayName }),
        });
        applySession(res);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Could not create an account.');
        throw e;
      }
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const authFetch = useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> => {
      const doFetch = async () => {
        const response = await fetch(`${API_BASE_URL}${path}`, {
          ...init,
          credentials: 'include',
          headers: {
            // Fastify rejects a JSON content-type header on a body-less
            // request, so only set it when there's actually a body to send -
            // and never on a FormData body (file uploads), where fetch must
            // set its own Content-Type with the multipart boundary itself.
            ...(init?.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
            ...(accessTokenRef.current ? { Authorization: `Bearer ${accessTokenRef.current}` } : {}),
            ...init?.headers,
          },
        });
        return response;
      };

      let response = await doFetch();
      if (response.status === 401) {
        const refreshed = await refresh();
        if (refreshed) response = await doFetch();
      }
      if (!response.ok) {
        let message = response.statusText;
        try {
          const body = (await response.json()) as { message?: string };
          if (body.message) message = body.message;
        } catch {
          // ignore
        }
        throw new ApiError(response.status, message);
      }
      if (response.status === 204) return undefined as T;
      return (await response.json()) as T;
    },
    [refresh],
  );

  const authFetchStream = useCallback(
    async (path: string, init?: RequestInit): Promise<Response> => {
      const doFetch = async () => {
        return fetch(`${API_BASE_URL}${path}`, {
          ...init,
          credentials: 'include',
          headers: {
            ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
            ...(accessTokenRef.current ? { Authorization: `Bearer ${accessTokenRef.current}` } : {}),
            ...init?.headers,
          },
        });
      };

      let response = await doFetch();
      if (response.status === 401) {
        const refreshed = await refresh();
        if (refreshed) response = await doFetch();
      }
      if (!response.ok) {
        let message = response.statusText;
        try {
          const body = (await response.json()) as { message?: string };
          if (body.message) message = body.message;
        } catch {
          // ignore
        }
        throw new ApiError(response.status, message);
      }
      return response;
    },
    [refresh],
  );

  return (
    <AuthContext.Provider value={{ status, user, error, login, register, logout, authFetch, authFetchStream }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

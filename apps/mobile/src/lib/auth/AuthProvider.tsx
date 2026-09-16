import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
// Plain React Native `fetch` doesn't expose a working streaming `response.body` (no
// ReadableStream support) - `expo/fetch` is Expo's native-backed replacement that does,
// needed for authFetchStream's SSE parsing. Kept separate from the plain `fetch` used
// elsewhere (JSON calls don't need it, and expo/fetch has a smaller surface otherwise).
import { fetch as expoFetch } from 'expo/fetch';
import { API_BASE_URL, ApiError, apiFetch } from '../api';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
}

interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  accessTokenExpiresIn: number;
  // Only present because this backend response also serves web (which ignores these two
  // fields and relies on the httpOnly cookie instead) - mobile is the client that actually
  // needs them, since it has no cookie jar. See apps/api AuthController.
  refreshToken: string;
  refreshTokenExpiresAt: string;
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
   * Same auth/refresh handling as authFetch, but returns the raw Response instead of
   * parsing it as JSON - for endpoints that stream a body (SSE) rather than one JSON object.
   */
  authFetchStream: (path: string, init?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const REFRESH_TOKEN_KEY = 'friday_refresh_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Access tokens are short-lived and kept in memory only, matching web's XSS-hardening
  // rationale (a compromised JS bundle shouldn't be able to read a persisted access token).
  const accessTokenRef = useRef<string | null>(null);

  const applySession = useCallback(async (res: AuthResponse) => {
    accessTokenRef.current = res.accessToken;
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, res.refreshToken);
    setUser(res.user);
    setStatus('authenticated');
  }, []);

  const clearSession = useCallback(async () => {
    accessTokenRef.current = null;
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const refresh = useCallback(async (): Promise<boolean> => {
    try {
      const storedRefreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      if (!storedRefreshToken) {
        await clearSession();
        return false;
      }
      const res = await apiFetch<AuthResponse>('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: storedRefreshToken }),
      });
      await applySession(res);
      return true;
    } catch {
      await clearSession();
      return false;
    }
  }, [applySession, clearSession]);

  const hasBootstrapped = useRef(false);
  useEffect(() => {
    if (hasBootstrapped.current) return;
    hasBootstrapped.current = true;
    // Only on mount: restore a session from the stored refresh token, if any. Mirrors
    // web's AuthProvider mount-time refresh call against the cookie.
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
        await applySession(res);
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
        await applySession(res);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Could not create an account.');
        throw e;
      }
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    try {
      const storedRefreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      await apiFetch('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: storedRefreshToken }),
      });
    } finally {
      await clearSession();
    }
  }, [clearSession]);

  const authFetch = useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> => {
      const doFetch = () =>
        fetch(`${API_BASE_URL}${path}`, {
          ...init,
          headers: {
            ...(init?.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
            ...(accessTokenRef.current ? { Authorization: `Bearer ${accessTokenRef.current}` } : {}),
            ...init?.headers,
          },
        });

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
      const doFetch = (): Promise<Response> =>
        expoFetch(`${API_BASE_URL}${path}`, {
          method: init?.method,
          body: init?.body as string | undefined,
          headers: {
            ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
            ...(accessTokenRef.current ? { Authorization: `Bearer ${accessTokenRef.current}` } : {}),
            ...(init?.headers as Record<string, string> | undefined),
          },
        });

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

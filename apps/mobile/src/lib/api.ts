// Ported from apps/web/src/lib/api.ts. One deliberate divergence: no `credentials: 'include'`
// - mobile has no cookie jar, the refresh token travels in the request body instead
// (see AuthProvider).
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface ApiErrorBody {
  message?: string | string[];
}

async function toApiError(response: Response): Promise<ApiError> {
  let message = response.statusText || `Request failed with status ${response.status}`;
  try {
    const body = (await response.json()) as ApiErrorBody;
    if (Array.isArray(body.message)) message = body.message.join(', ');
    else if (typeof body.message === 'string') message = body.message;
  } catch {
    // Non-JSON error body - fall back to statusText.
  }
  return new ApiError(response.status, message);
}

/** Plain (unauthenticated) JSON fetch against the backend API. */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

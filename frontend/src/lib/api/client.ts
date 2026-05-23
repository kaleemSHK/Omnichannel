/**
 * Base HTTP client for BlinkOne frontend.
 *
 * Two API bases:
 *   1. Chatwoot REST  → NEXT_PUBLIC_CHATWOOT_URL (default :3000) /api/v1 and /api/v2
 *      Auth: `api_access_token` header (Chatwoot user token)
 *
 *   2. BlinkOne gateway → NEXT_PUBLIC_API_BASE (default :8080) /api/{service}
 *      Auth: `Authorization: Bearer <gatewayJwt>` header
 */

import { useAuthStore } from '@/lib/store/auth';
import { CHATWOOT_URL, GATEWAY_URL } from '@/lib/env';
import type { ApiError } from '@/types';

class BlinkoneApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'BlinkoneApiError';
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.ok) {
    // 204 No Content
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  let errBody: Partial<ApiError> = {};
  try {
    errBody = await res.json();
  } catch {
    /* ignore */
  }

  throw new BlinkoneApiError(
    errBody.code ?? 'HTTP_ERROR',
    errBody.message ?? `Request failed with status ${res.status}`,
    res.status,
  );
}

// ─── Chatwoot REST client ──────────────────────────────────────────────────────
// Uses Chatwoot's own `api_access_token` header
export async function cwFetch<T>(
  path: string,
  init: RequestInit = {},
  version: 'v1' | 'v2' = 'v1',
): Promise<T> {
  const { tokens } = useAuthStore.getState();
  const url = `${CHATWOOT_URL}/api/${version}${path}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(tokens?.accessToken ? { api_access_token: tokens.accessToken } : {}),
      ...(init.headers ?? {}),
    },
  });

  return handleResponse<T>(res);
}

// ─── BlinkOne gateway client ───────────────────────────────────────────────────
// Uses gateway JWT with tenant_id + roles
export async function bnFetch<T>(
  service: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const { tokens } = useAuthStore.getState();
  const url = `${GATEWAY_URL}/api/${service}${path}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(tokens?.gatewayJwt
        ? { Authorization: `Bearer ${tokens.gatewayJwt}` }
        : {}),
      ...(init.headers ?? {}),
    },
  });

  return handleResponse<T>(res);
}

export { BlinkoneApiError };

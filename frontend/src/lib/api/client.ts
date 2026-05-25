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
import { shouldSkipGatewayFetch } from '@/lib/demo/config';
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

  let errBody: Partial<ApiError> & { error?: string } = {};
  try {
    errBody = await res.json();
  } catch {
    /* ignore */
  }

  const message =
    errBody.message ??
    (typeof errBody.error === 'string' ? errBody.error : undefined) ??
    `Request failed with status ${res.status}`;

  throw new BlinkoneApiError(errBody.code ?? 'HTTP_ERROR', message, res.status);
}

function buildHeaders(
  init: RequestInit,
  authHeaders: Record<string, string>,
): HeadersInit {
  const isFormData =
    typeof FormData !== 'undefined' && init.body instanceof FormData;

  return {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...authHeaders,
    ...(init.headers ?? {}),
  };
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
    headers: buildHeaders(init, {
      ...(tokens?.accessToken ? { api_access_token: tokens.accessToken } : {}),
    }),
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
  if (shouldSkipGatewayFetch()) {
    throw new BlinkoneApiError(
      'SKIP_GATEWAY',
      'Gateway fetch skipped (demo mode or missing JWT)',
      0,
    );
  }

  const { tokens } = useAuthStore.getState();
  const url = `${GATEWAY_URL}/api/${service}${path}`;

  const res = await fetch(url, {
    ...init,
    headers: buildHeaders(init, {
      ...(tokens?.gatewayJwt
        ? { Authorization: `Bearer ${tokens.gatewayJwt}` }
        : {}),
    }),
  });

  if (res.status === 401 || res.status === 403) {
    const { markGatewayAuthFailed } = await import('@/lib/demo/config');
    markGatewayAuthFailed();
  }

  return handleResponse<T>(res);
}

export { BlinkoneApiError };

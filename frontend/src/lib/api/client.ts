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

import { refreshGatewayToken } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/store/auth';
import {
  isDemoDataEnabled,
  isGatewayAuthFailed,
  resetGatewayAuthFailed,
  shouldSkipGatewayFetch,
} from '@/lib/demo/config';
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

async function readJsonBody<T>(res: Response): Promise<T | undefined> {
  const text = await res.text();
  if (!text.trim()) return undefined;
  return JSON.parse(text) as T;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.ok) {
    // 204 No Content, or 200/201 with empty body (e.g. Chatwoot DELETE)
    if (res.status === 204) return undefined as T;
    const body = await readJsonBody<T>(res);
    return (body ?? undefined) as T;
  }

  let errBody: Partial<ApiError> & {
    error?: string | { code?: string; message?: string };
  } = {};
  try {
    errBody = (await readJsonBody(res)) ?? {};
  } catch {
    /* ignore */
  }

  // BlinkOne services return { error: { code, message } }; Chatwoot returns
  // { message } or { error: "..." }. Support all shapes so the real reason surfaces.
  const nestedError =
    errBody.error && typeof errBody.error === 'object' ? errBody.error : undefined;

  const message =
    errBody.message ??
    nestedError?.message ??
    (typeof errBody.error === 'string' ? errBody.error : undefined) ??
    `Request failed with status ${res.status}`;

  const code = errBody.code ?? nestedError?.code ?? 'HTTP_ERROR';

  throw new BlinkoneApiError(code, message, res.status);
}

/** Exchange Chatwoot token for gateway JWT when missing or after auth flag was set. */
export async function ensureGatewayJwt(): Promise<string> {
  if (isDemoDataEnabled()) {
    throw new BlinkoneApiError('SKIP_GATEWAY', 'Gateway not used in demo mode', 0);
  }

  const { tokens, updateTokens } = useAuthStore.getState();
  if (tokens?.gatewayJwt && !isGatewayAuthFailed()) {
    return tokens.gatewayJwt;
  }

  const cwToken = tokens?.accessToken;
  if (!cwToken) {
    throw new BlinkoneApiError(
      'NO_AUTH',
      'Sign in required to use ticket fields and other BlinkOne services.',
      401,
    );
  }

  try {
    resetGatewayAuthFailed();
    const gw = await refreshGatewayToken(cwToken);
    if (!gw.token) throw new Error('Empty gateway token');
    updateTokens({ accessToken: cwToken, gatewayJwt: gw.token });
    return gw.token;
  } catch {
    throw new BlinkoneApiError(
      'GATEWAY_SESSION',
      'Could not connect to BlinkOne services. Sign out, sign in again, or check that the gateway is running.',
      503,
    );
  }
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

  // Chatwoot returns 401 when the access token has been revoked or expired.
  // Clear the local session so the RoleGuard redirects to /login.
  if (res.status === 401) {
    useAuthStore.getState().clearAuth();
  }

  return handleResponse<T>(res);
}

// ─── BlinkOne gateway client ───────────────────────────────────────────────────
// Uses gateway JWT with tenant_id + roles
export async function bnFetch<T>(
  service: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  if (isDemoDataEnabled()) {
    throw new BlinkoneApiError(
      'SKIP_GATEWAY',
      'Gateway fetch skipped (demo mode)',
      0,
    );
  }

  if (shouldSkipGatewayFetch()) {
    await ensureGatewayJwt();
  }

  const { tokens } = useAuthStore.getState();
  if (!tokens?.gatewayJwt) {
    throw new BlinkoneApiError(
      'NO_GATEWAY_JWT',
      'BlinkOne session unavailable. Sign out and sign in again.',
      0,
    );
  }
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
    // Only invalidate the gateway session when the *gateway itself* rejects our JWT.
    // A 401/403 that comes from a downstream service proxied through the gateway
    // (e.g. routing returning 401 because ROUTING_TOKEN is misconfigured) must NOT
    // kill the gateway session — that would silently disable all other features.
    // The gateway always sets X-Request-Id; downstream services that produce their
    // own 401 before the gateway adds that header won't have it, but the safe
    // discriminator is the error code: the gateway uses 'UNAUTHORIZED'/'FORBIDDEN'
    // with the message "Invalid or expired token" / "Bearer token required".
    let isGatewayAuthError = false;
    try {
      const body = await res.clone().json() as { error?: { code?: string; message?: string } };
      const code = body?.error?.code;
      const msg  = body?.error?.message ?? '';
      isGatewayAuthError =
        (code === 'UNAUTHORIZED' || code === 'FORBIDDEN') &&
        // Gateway-level messages contain these substrings; service-level ones say "Unauthorized"
        (msg.includes('token') || msg.includes('Token') || msg.includes('expired') || msg.includes('required'));
      if (isGatewayAuthError) {
        const { markGatewayAuthFailed } = await import('@/lib/demo/config');
        markGatewayAuthFailed();
      }
    } catch {
      // Non-JSON 401/403 — treat as gateway auth failure conservatively only for 401
      if (res.status === 401) {
        isGatewayAuthError = true;
        const { markGatewayAuthFailed } = await import('@/lib/demo/config');
        markGatewayAuthFailed();
      }
    }

    // When the gateway confirms the session is expired/invalid, clear the auth
    // store so the RoleGuard redirects to /login on the next render cycle.
    if (isGatewayAuthError) {
      useAuthStore.getState().clearAuth();
    }
  }

  return handleResponse<T>(res);
}

export { BlinkoneApiError };

import { useAuthStore } from '@/store/auth';
import { CHATWOOT_URL, GATEWAY_URL } from '@/lib/env';

export class BlinkoneApiError extends Error {
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
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }
  let errBody: { code?: string; message?: string } = {};
  try {
    errBody = await res.json();
  } catch {
    /* ignore */
  }
  throw new BlinkoneApiError(
    errBody.code ?? 'HTTP_ERROR',
    errBody.message ?? `Request failed: ${res.status}`,
    res.status,
  );
}

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

export async function bnFetch<T>(service: string, path: string, init: RequestInit = {}): Promise<T> {
  const { tokens } = useAuthStore.getState();
  if (!tokens?.gatewayJwt) throw new BlinkoneApiError('NO_JWT', 'Not authenticated', 401);
  const url = `${GATEWAY_URL}/api/${service}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokens.gatewayJwt}`,
      ...(init.headers ?? {}),
    },
  });
  return handleResponse<T>(res);
}

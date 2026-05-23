/**
 * Auth API — Chatwoot login + BlinkOne gateway JWT exchange.
 *
 * Flow:
 *  1. POST /auth/sign_in → Chatwoot returns user + access_token
 *  2. POST /api/auth/token → gateway exchanges CW token for BlinkOne JWT
 *     (gateway verifies CW token, reads tenant_id, issues signed JWT)
 */

import { CHATWOOT_URL, GATEWAY_URL } from '@/lib/env';
import { resolveRoleFromAuth } from '@/lib/roles';
import type { BlinkoneUser, AuthTokens } from '@/types';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface ChaiwootAuthResponse {
  data: {
    access_token: string;
    token_type: string;
    account_id: number;
    role: string;
    email: string;
    name: string;
    avatar_url: string;
    id: number;
  };
}

export interface GatewayTokenResponse {
  token: string;      // signed JWT
  expiresIn: number;
}

async function authFetch(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (e) {
    if (e instanceof TypeError) {
      throw new Error(
        'Cannot reach the API. Ensure Chatwoot (:3000) and the API gateway (:8080) are running.',
      );
    }
    throw e;
  }
}

export async function loginWithPassword(payload: LoginPayload): Promise<{
  user: BlinkoneUser;
  tokens: AuthTokens;
}> {
  // Step 1 — Chatwoot sign in
  const cwRes = await authFetch(`${CHATWOOT_URL}/auth/sign_in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: payload.email, password: payload.password }),
  });

  if (!cwRes.ok) {
    const err = await cwRes.json().catch(() => ({}));
    throw new Error(err?.error ?? 'Invalid email or password');
  }

  const cw: ChaiwootAuthResponse = await cwRes.json();
  const cwToken = cw.data.access_token;

  // Step 2 — exchange for gateway JWT
  const gwRes = await authFetch(`${GATEWAY_URL}/api/auth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Access-Token': cwToken,
      api_access_token: cwToken,
    },
    body: '{}',
  });

  if (!gwRes.ok) {
    const err = await gwRes.json().catch(() => ({}));
    const msg =
      (err as { error?: { message?: string } })?.error?.message ??
      (err as { message?: string })?.message ??
      'Gateway token exchange failed';
    throw new Error(msg);
  }

  const gw: GatewayTokenResponse = await gwRes.json();

  const user: BlinkoneUser = {
    id: cw.data.id,
    name: cw.data.name,
    email: cw.data.email,
    role: resolveRoleFromAuth(cw.data.role, gw.token, cw.data.email),
    tenantId: String(cw.data.account_id),
    chatwootAccountId: cw.data.account_id,
    avatarUrl: cw.data.avatar_url,
  };

  return {
    user,
    tokens: { accessToken: cwToken, gatewayJwt: gw.token },
  };
}

export async function refreshGatewayToken(cwToken: string): Promise<GatewayTokenResponse> {
  const res = await authFetch(`${GATEWAY_URL}/api/auth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Access-Token': cwToken,
      api_access_token: cwToken,
    },
    body: '{}',
  });
  if (!res.ok) throw new Error('Token refresh failed');
  return res.json();
}

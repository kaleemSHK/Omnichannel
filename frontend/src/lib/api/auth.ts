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

/** Returned by the gateway when the user has MFA enabled — login is not yet complete. */
export interface MfaChallengeResponse {
  mfa_required: true;
  mfa_token: string;   // short-lived JWT containing userId/tenantId; pass to /api/auth/mfa
}

async function authFetch(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (e) {
    if (e instanceof TypeError) {
      throw new Error(
        'Cannot reach the API. Start Docker services (Chatwoot :3000, gateway :8787) or check CHATWOOT_UPSTREAM / GATEWAY_UPSTREAM in frontend/.env.local.',
      );
    }
    throw e;
  }
}

export async function loginWithPassword(payload: LoginPayload): Promise<
  | { user: BlinkoneUser; tokens: AuthTokens }
  | { mfa_required: true; mfa_token: string; user: BlinkoneUser; tokens: AuthTokens }
> {
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
    const nested = (err as { error?: { message?: string; code?: string } })?.error;
    const msg =
      nested?.message ??
      (err as { message?: string })?.message ??
      `Gateway token exchange failed (HTTP ${gwRes.status})`;
    if (gwRes.status === 401) {
      throw new Error(msg);
    }
    if (nested?.code === 'CONFIG_ERROR') {
      throw new Error('Gateway misconfigured: set JWT_SECRET in the root .env and restart the gateway container.');
    }
    throw new Error(
      `${msg}. Is the gateway running? Start it with: docker compose up -d gateway chatwoot (port 8787).`,
    );
  }

  const gwBody = await gwRes.json();

  // Sprint 2 M01: handle MFA challenge from gateway
  if (gwBody && 'mfa_required' in gwBody && gwBody.mfa_required) {
    const challenge = gwBody as MfaChallengeResponse;
    // Build a partial user object from Chatwoot data for pending login state
    const partialUser: BlinkoneUser = {
      id: cw.data.id,
      name: cw.data.name,
      email: cw.data.email,
      role: resolveRoleFromAuth(cw.data.role, '', cw.data.email),
      tenantId: String(cw.data.account_id),
      chatwootAccountId: cw.data.account_id,
      avatarUrl: cw.data.avatar_url,
    };
    return {
      mfa_required: true,
      mfa_token: challenge.mfa_token,
      user: partialUser,
      tokens: { accessToken: cwToken, gatewayJwt: '' },
    };
  }

  const gw = gwBody as GatewayTokenResponse;

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

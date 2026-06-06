import { CHATWOOT_URL, GATEWAY_URL } from '@/lib/env';
import { hydratePermissionsFromJwt, hydratePermissionsFromLogin } from '@/lib/permissions';
import type { BlinkoneUser, AuthTokens } from '@/types';

import Config from 'react-native-config';

function cfg(key: string, fallback = ''): string {
  const v = Config[key as keyof typeof Config];
  return typeof v === 'string' ? v : fallback;
}

function resolveRole(cwRole: string, email: string): BlinkoneUser['role'] {
  const platformAdmins = cfg('PLATFORM_ADMINS', '').split(',');
  if (platformAdmins.includes(email)) return 'platform_admin';
  if (cwRole === 'administrator') return 'admin';
  if (cwRole === 'supervisor') return 'supervisor';
  return 'agent';
}

export async function loginWithPassword(
  email: string,
  password: string,
): Promise<{ user: BlinkoneUser; tokens: AuthTokens }> {
  const cwRes = await fetch(`${CHATWOOT_URL}/auth/sign_in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!cwRes.ok) {
    const err = await cwRes.json().catch(() => ({}));
    throw new Error(err?.error ?? 'Invalid email or password');
  }
  const cw = await cwRes.json();
  const cwToken: string = cw.data.access_token;

  const gwRes = await fetch(`${GATEWAY_URL}/api/auth/token`, {
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
    throw new Error(err?.message ?? 'Gateway authentication failed');
  }
  const gw = await gwRes.json();
  hydratePermissionsFromLogin(gw);
  hydratePermissionsFromJwt(gw.token);

  const user: BlinkoneUser = {
    id: cw.data.id,
    name: cw.data.name,
    email: cw.data.email,
    role: resolveRole(cw.data.role, cw.data.email),
    tenantId: String(cw.data.account_id),
    chatwootAccountId: cw.data.account_id,
    avatarUrl: cw.data.avatar_url,
  };

  return { user, tokens: { accessToken: cwToken, gatewayJwt: gw.token, pubsubToken: cw.data.pubsub_token } };
}

export async function fetchProfile(
  accessToken: string,
): Promise<{ user: BlinkoneUser; pubsubToken?: string }> {
  const res = await fetch(`${CHATWOOT_URL}/api/v1/profile`, {
    headers: { api_access_token: accessToken },
  });
  if (!res.ok) throw new Error('Session expired');
  const profile = await res.json();
  return {
    user: {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      role: resolveRole(profile.role, profile.email),
      tenantId: String(profile.account_id),
      chatwootAccountId: profile.account_id,
      avatarUrl: profile.avatar_url,
    },
    pubsubToken: profile.pubsub_token as string | undefined,
  };
}

/** Re-issue gateway JWT from a valid Chatwoot access token (session restore). */
export async function refreshGatewayToken(accessToken: string): Promise<string> {
  const gwRes = await fetch(`${GATEWAY_URL}/api/auth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Access-Token': accessToken,
      api_access_token: accessToken,
    },
    body: '{}',
  });
  if (!gwRes.ok) {
    const err = await gwRes.json().catch(() => ({}));
    throw new Error(err?.message ?? 'Gateway token refresh failed');
  }
  const gw = await gwRes.json();
  hydratePermissionsFromLogin(gw);
  hydratePermissionsFromJwt(gw.token);
  return gw.token as string;
}

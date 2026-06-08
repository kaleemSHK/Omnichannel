import { createHmac } from 'node:crypto';
import { inviteUserToAccount } from './chatwoot-platform.js';
import * as serviceRepo from './chatwoot-service-repo.js';
import * as repo from './repo.js';

const BASE = (process.env.CHATWOOT_URL || 'http://chatwoot:3000').replace(/\/$/, '');
const PLATFORM_TOKEN = (process.env.CHATWOOT_PLATFORM_TOKEN || process.env.PLATFORM_APP_TOKEN || '').trim();

export function serviceEmail(accountId) {
  return `blinkone-automation+${accountId}@system.blinksone.internal`;
}

export function servicePassword(tenantId) {
  const secret = (
    process.env.TENANT_CHATWOOT_SERVICE_SECRET
    || process.env.PLATFORM_TOKEN
    || 'blinkone-dev'
  ).trim();
  const digest = createHmac('sha256', secret).update(`cw-automation:${tenantId}`).digest('hex');
  return `Bn-${digest.slice(0, 20)}!1`;
}

async function platformFetch(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      api_access_token: PLATFORM_TOKEN,
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Chatwoot platform ${init.method || 'GET'} ${path} ${res.status}: ${text.slice(0, 300)}`);
  }
  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('json')) return null;
  return res.json();
}

async function findUserByEmail(email) {
  if (!PLATFORM_TOKEN) return null;
  try {
    const res = await fetch(`${BASE}/platform/api/v1/users?email=${encodeURIComponent(email)}`, {
      headers: { api_access_token: PLATFORM_TOKEN },
    });
    if (!res.ok) return null;
    const list = await res.json();
    const hit = Array.isArray(list) ? list[0] : list?.payload?.[0] ?? list?.data?.[0];
    const id = hit?.id ?? hit?.user_id;
    return id ? Number(id) : null;
  } catch {
    return null;
  }
}

async function linkUserToAccount(accountId, userId) {
  if (!PLATFORM_TOKEN) return;
  try {
    await platformFetch(`/platform/api/v1/accounts/${accountId}/account_users`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, role: 'administrator' }),
    });
  } catch (e) {
    if (!/422|409|already/i.test(e.message)) throw e;
  }
}

async function signIn(email, password) {
  const res = await fetch(`${BASE}/auth/sign_in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Chatwoot sign_in ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  const token = json?.data?.access_token ?? json?.access_token;
  if (!token) throw new Error('Chatwoot sign_in: missing access_token');
  return token;
}

async function ensurePlatformUser(accountId, tenantId) {
  const email = serviceEmail(accountId);
  const password = servicePassword(tenantId);
  let userId = await findUserByEmail(email);

  if (!userId) {
    if (!PLATFORM_TOKEN) {
      throw Object.assign(new Error('CHATWOOT_PLATFORM_TOKEN not configured'), { code: 'NOT_CONFIGURED' });
    }
    const created = await inviteUserToAccount({
      accountId,
      name: 'BlinkOne Automation',
      email,
      password,
      role: 'administrator',
    });
    userId = created.id;
  } else {
    await linkUserToAccount(accountId, userId);
  }

  return { userId, email, password };
}

/**
 * Ensure a tenant-scoped Chatwoot API token exists (automation user, not per-agent).
 * @returns {{ accessToken: string, chatwootUserId: number, serviceEmail: string, refreshed: boolean }}
 */
export async function ensureTenantServiceToken(tenantId, { forceRefresh = false } = {}) {
  const tenant = await repo.getTenantPlatform(String(tenantId));
  if (!tenant) {
    throw Object.assign(new Error('Tenant not found'), { code: 'NOT_FOUND' });
  }

  const accountId = Number(tenant.chatwootAccountId ?? tenantId);
  const existing = await serviceRepo.getServiceRecord(tenantId);

  if (existing?.access_token && !forceRefresh) {
    return {
      accessToken: existing.access_token,
      chatwootUserId: Number(existing.chatwoot_user_id),
      serviceEmail: existing.service_email,
      refreshed: false,
    };
  }

  const { userId, email, password } = await ensurePlatformUser(accountId, tenantId);
  let accessToken;
  try {
    accessToken = await signIn(email, password);
  } catch (e) {
    const err = Object.assign(
      new Error(
        `Automation user exists but sign-in failed for tenant ${tenantId}. `
        + 'Run scripts/ensure-tenant-chatwoot-service.rb once to reset the service password.',
      ),
      { code: 'SERVICE_AUTH_FAILED', cause: e },
    );
    throw err;
  }

  await serviceRepo.upsertServiceRecord({
    tenantId: String(tenantId),
    chatwootUserId: userId,
    serviceEmail: email,
    accessToken,
  });

  return {
    accessToken,
    chatwootUserId: userId,
    serviceEmail: email,
    refreshed: true,
  };
}

/** Resolve token for sidecars; returns null when unavailable. */
export async function getTenantServiceToken(tenantId) {
  try {
    const row = await serviceRepo.getServiceRecord(tenantId);
    if (row?.access_token) {
      return {
        accessToken: row.access_token,
        chatwootUserId: Number(row.chatwoot_user_id),
        serviceEmail: row.service_email,
      };
    }
    return await ensureTenantServiceToken(tenantId);
  } catch {
    return null;
  }
}

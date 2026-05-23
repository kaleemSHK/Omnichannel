const BASE = (process.env.CHATWOOT_URL || 'http://chatwoot:3000').replace(/\/$/, '');
const TOKEN = (process.env.CHATWOOT_PLATFORM_TOKEN || process.env.PLATFORM_APP_TOKEN || '').trim();

function mapRole(groups = [], explicitRole) {
  if (explicitRole) return explicitRole;
  if (groups.includes('admin') || groups.includes('administrator')) return 'administrator';
  if (groups.includes('supervisor')) return 'supervisor';
  return 'agent';
}

/**
 * Create or update a Chatwoot account user via Platform API (JIT after SSO).
 */
export async function jitProvisionChatwootUser({
  email,
  name,
  accountId,
  role,
  groups = [],
}) {
  const chatwootRole = mapRole(groups, role);
  if (!TOKEN) {
    return {
      status: 'provisioned_stub',
      email,
      role: chatwootRole,
      chatwootUserId: null,
      stub: true,
    };
  }

  const account_id = Number(accountId);
  if (!Number.isFinite(account_id) || account_id <= 0) {
    const err = new Error('chatwootAccountId required for JIT provision');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  let existingId = null;
  try {
    const listRes = await fetch(`${BASE}/platform/api/v1/users?email=${encodeURIComponent(email)}`, {
      headers: { api_access_token: TOKEN },
    });
    if (listRes.ok) {
      const list = await listRes.json();
      const hit = Array.isArray(list) ? list[0] : list?.payload?.[0] ?? list?.data?.[0];
      existingId = hit?.id ?? hit?.user_id ?? null;
    }
  } catch {
    /* list-by-email optional on some Chatwoot builds */
  }

  const displayName = name || email.split('@')[0];
  const password = process.env.CHATWOOT_JIT_TEMP_PASSWORD || `BlinkOne-${Date.now().toString(36)}!`;

  if (existingId) {
    const patchRes = await fetch(`${BASE}/platform/api/v1/users/${existingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', api_access_token: TOKEN },
      body: JSON.stringify({
        name: displayName,
        account_id,
        role: chatwootRole,
      }),
    });
    if (!patchRes.ok) {
      const text = await patchRes.text();
      throw new Error(`Chatwoot user update ${patchRes.status}: ${text.slice(0, 300)}`);
    }
    const user = await patchRes.json();
    return {
      status: 'updated',
      email,
      role: chatwootRole,
      chatwootUserId: user.id ?? existingId,
      stub: false,
    };
  }

  const createRes = await fetch(`${BASE}/platform/api/v1/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', api_access_token: TOKEN },
    body: JSON.stringify({
      name: displayName,
      email,
      password,
      account_id,
      role: chatwootRole,
    }),
  });
  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`Chatwoot user create ${createRes.status}: ${text.slice(0, 300)}`);
  }
  const user = await createRes.json();
  return {
    status: 'created',
    email,
    role: chatwootRole,
    chatwootUserId: user.id ?? user.user_id,
    stub: false,
    tempPasswordIssued: !!process.env.CHATWOOT_JIT_RETURN_PASSWORD,
    ...(process.env.CHATWOOT_JIT_RETURN_PASSWORD === '1' ? { tempPassword: password } : {}),
  };
}

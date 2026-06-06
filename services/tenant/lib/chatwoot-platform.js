const BASE = (process.env.CHATWOOT_URL || 'http://chatwoot:3000').replace(/\/$/, '');
const TOKEN = (process.env.CHATWOOT_PLATFORM_TOKEN || process.env.PLATFORM_APP_TOKEN || '').trim();

async function platformFetch(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      api_access_token: TOKEN,
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Chatwoot platform ${init.method || 'GET'} ${path} ${res.status}: ${text.slice(0, 400)}`);
  }
  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('json')) return null;
  return res.json();
}

export function generateTempPassword() {
  const fixed = process.env.CHATWOOT_OWNER_TEMP_PASSWORD?.trim();
  if (fixed) return fixed;
  return `BlinkOne-${Date.now().toString(36)}!A1`;
}

function ownerTempPassword() {
  return generateTempPassword();
}

/**
 * Create Chatwoot account + owner user (email pre-confirmed via Platform API).
 * @returns {{ id: number, name: string, stub?: boolean, ownerUserId?: number, ownerTempPassword?: string }}
 */
export async function createChatwootAccount({ name, ownerEmail, ownerName }) {
  if (!TOKEN) {
    const stubId = Number(process.env.CHATWOOT_STUB_ACCOUNT_SEQ || '9000') + Math.floor(Math.random() * 1000);
    return { id: stubId, name, stub: true };
  }

  const account = await platformFetch('/platform/api/v1/accounts', {
    method: 'POST',
    body: JSON.stringify({ name, locale: 'en', status: 'active' }),
  });
  const accountId = account.id ?? account.account_id;
  if (!accountId) {
    throw new Error('Chatwoot platform createAccount: missing account id');
  }

  let ownerUserId;
  let tempPassword;

  const email = ownerEmail?.trim().toLowerCase();
  if (email) {
    tempPassword = ownerTempPassword();
    const displayName = ownerName?.trim() || email.split('@')[0] || 'Owner';
    const user = await platformFetch('/platform/api/v1/users', {
      method: 'POST',
      body: JSON.stringify({
        name: displayName,
        email,
        password: tempPassword,
      }),
    });
    ownerUserId = user.id ?? user.user_id;
    if (!ownerUserId) {
      throw new Error('Chatwoot platform createUser: missing user id');
    }

    await platformFetch(`/platform/api/v1/accounts/${accountId}/account_users`, {
      method: 'POST',
      body: JSON.stringify({ user_id: ownerUserId, role: 'administrator' }),
    });
  }

  return {
    id: accountId,
    name: account.name ?? name,
    stub: false,
    ownerUserId,
    ownerTempPassword: tempPassword,
  };
}

/**
 * Create a Chatwoot user with password and link to an account (Platform API).
 * Used when tenant admins invite agents — same flow as owner provisioning.
 */
export async function inviteUserToAccount({ accountId, name, email, password, role = 'agent' }) {
  if (!TOKEN) {
    throw Object.assign(new Error('CHATWOOT_PLATFORM_TOKEN not configured on server'), { code: 'NOT_CONFIGURED' });
  }
  const account = Number(accountId);
  if (!Number.isFinite(account)) {
    throw Object.assign(new Error('Invalid account id'), { code: 'VALIDATION' });
  }
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const displayName = String(name || '').trim() || normalizedEmail.split('@')[0];
  const pwd = String(password || '').trim();
  if (!normalizedEmail || !pwd || pwd.length < 8) {
    throw Object.assign(new Error('email and password (min 8 chars) required'), { code: 'VALIDATION' });
  }

  const user = await platformFetch('/platform/api/v1/users', {
    method: 'POST',
    body: JSON.stringify({
      name: displayName,
      email: normalizedEmail,
      password: pwd,
    }),
  });
  const userId = user.id ?? user.user_id;
  if (!userId) {
    throw new Error('Chatwoot platform createUser: missing user id');
  }

  const cwRole = role === 'administrator' ? 'administrator' : 'agent';
  await platformFetch(`/platform/api/v1/accounts/${account}/account_users`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, role: cwRole }),
  });

  return { id: Number(userId), email: normalizedEmail, name: displayName };
}

/** Remove a user from a Chatwoot account (Platform API). */
export async function removeUserFromAccount({ accountId, userId }) {
  if (!TOKEN) return { skipped: true };
  const account = Number(accountId);
  const uid = Number(userId);
  if (!Number.isFinite(account) || !Number.isFinite(uid)) {
    throw Object.assign(new Error('Invalid account or user id'), { code: 'VALIDATION' });
  }

  // Platform API: DELETE .../account_users with { user_id } in body (not /account_users/:id)
  await platformFetch(`/platform/api/v1/accounts/${account}/account_users`, {
    method: 'DELETE',
    body: JSON.stringify({ user_id: uid }),
  });
  return { removed: true, chatwootUserId: uid };
}

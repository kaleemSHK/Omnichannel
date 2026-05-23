const BASE = (process.env.CHATWOOT_URL || 'http://chatwoot:3000').replace(/\/$/, '');
const TOKEN = (process.env.CHATWOOT_PLATFORM_TOKEN || process.env.PLATFORM_APP_TOKEN || '').trim();

export async function createChatwootAccount({ name, ownerEmail }) {
  if (!TOKEN) {
    const stubId = Number(process.env.CHATWOOT_STUB_ACCOUNT_SEQ || '9000') + Math.floor(Math.random() * 1000);
    return { id: stubId, name, stub: true };
  }

  const res = await fetch(`${BASE}/platform/api/v1/accounts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      api_access_token: TOKEN,
    },
    body: JSON.stringify({
      name,
      locale: 'en',
      status: 'active',
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Chatwoot platform createAccount ${res.status}: ${text.slice(0, 300)}`);
  }
  const account = await res.json();
  const accountId = account.id ?? account.account_id;

  if (ownerEmail) {
    try {
      await fetch(`${BASE}/platform/api/v1/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', api_access_token: TOKEN },
        body: JSON.stringify({
          name: name.split(' ')[0] || 'Owner',
          email: ownerEmail,
          password: process.env.CHATWOOT_OWNER_TEMP_PASSWORD || `BlinkOne-${Date.now()}!`,
          account_id: accountId,
          role: 'administrator',
        }),
      });
    } catch {
      /* owner user optional when platform user API unavailable */
    }
  }

  return { id: accountId, name: account.name ?? name, stub: false };
}

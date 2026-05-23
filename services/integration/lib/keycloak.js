const KC_URL = (process.env.KEYCLOAK_URL || 'http://blinkone-keycloak:8080').replace(/\/$/, '');
const KC_ADMIN = (process.env.KEYCLOAK_ADMIN_USER || 'admin').trim();
const KC_PASS = (process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin').trim();
const KC_REALM = process.env.KEYCLOAK_MASTER_REALM || 'master';

async function adminToken() {
  if (process.env.KEYCLOAK_STUB === '1') return 'stub-token';
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: 'admin-cli',
    username: KC_ADMIN,
    password: KC_PASS,
  });
  const res = await fetch(`${KC_URL}/realms/${KC_REALM}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`Keycloak token ${res.status}`);
  const json = await res.json();
  return json.access_token;
}

/** Provision tenant realm + OIDC IdP stub (Prompt 10). */
export async function provisionRealm({ slug, providerType, clientId, discoveryUrl }) {
  if (process.env.KEYCLOAK_STUB === '1') {
    return { realm: `blinkone-${slug}`, status: 'stub', providerType };
  }
  const token = await adminToken();
  const realm = `blinkone-${slug}`;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  let res = await fetch(`${KC_URL}/admin/realms`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ realm, enabled: true }),
  });
  if (res.status !== 201 && res.status !== 409) {
    throw new Error(`Keycloak realm create ${res.status}`);
  }
  if (providerType === 'oidc' && discoveryUrl) {
    res = await fetch(`${KC_URL}/admin/realms/${realm}/identity-provider/instances`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        alias: 'tenant-idp',
        providerId: 'oidc',
        enabled: true,
        config: { clientId, discoveryUrl },
      }),
    });
    if (!res.ok && res.status !== 409) throw new Error(`Keycloak IdP ${res.status}`);
  }

  const redirectUri = `${(process.env.FRONTEND_URL || 'http://localhost').replace(/\/$/, '')}/blinkone/auth/callback`;
  const clientPayload = {
    clientId: 'blinkone-dashboard',
    name: 'BlinkOne Dashboard',
    enabled: true,
    publicClient: true,
    standardFlowEnabled: true,
    directAccessGrantsEnabled: false,
    redirectUris: [redirectUri, `${redirectUri}/*`],
    webOrigins: ['+'],
    attributes: { 'post.logout.redirect.uris': '+' },
  };
  res = await fetch(`${KC_URL}/admin/realms/${realm}/clients`, {
    method: 'POST',
    headers,
    body: JSON.stringify(clientPayload),
  });
  if (!res.ok && res.status !== 409) throw new Error(`Keycloak client ${res.status}`);

  return { realm, status: 'provisioned', clientId: 'blinkone-dashboard' };
}

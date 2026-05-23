import jwt from 'jsonwebtoken';
import { getSsoConfig } from './integration-repo.js';
import { jitProvisionChatwootUser } from './chatwoot-jit.js';

const KC_URL = (process.env.KEYCLOAK_URL || 'http://blinkone-keycloak:8080').replace(/\/$/, '');
const FRONTEND = (process.env.FRONTEND_URL || 'http://localhost').replace(/\/$/, '');

function parseState(state) {
  if (!state) return {};
  try {
    const json = Buffer.from(state, 'base64url').toString('utf8');
    return JSON.parse(json);
  } catch {
    return { slug: state };
  }
}

export function buildOAuthState({ tenantId, slug, accountId }) {
  return Buffer.from(JSON.stringify({ tenantId, slug, accountId }), 'utf8').toString('base64url');
}

async function exchangeCode({ realm, code, redirectUri }) {
  if (process.env.KEYCLOAK_STUB === '1') {
    return {
      email: 'sso-stub@blinkone.local',
      name: 'SSO Stub User',
      groups: ['admin'],
      sub: 'stub-sub',
    };
  }
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: 'blinkone-dashboard',
    code,
    redirect_uri: redirectUri,
  });
  const clientSecret = process.env.KEYCLOAK_DASHBOARD_CLIENT_SECRET || '';
  if (clientSecret) body.set('client_secret', clientSecret);

  const res = await fetch(`${KC_URL}/realms/${realm}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Keycloak token exchange ${res.status}: ${text.slice(0, 200)}`);
  }
  const tokens = await res.json();
  const idToken = tokens.id_token;
  if (!idToken) throw new Error('No id_token in Keycloak response');
  const payload = jwt.decode(idToken);
  if (!payload || typeof payload !== 'object') throw new Error('Invalid id_token');
  return {
    email: payload.email || payload.preferred_username,
    name: payload.name || payload.given_name,
    groups: payload.groups || payload.realm_access?.roles || [],
    sub: payload.sub,
  };
}

/**
 * OIDC authorization-code callback: exchange code, JIT user, mint gateway JWT.
 */
export async function handleSsoCallback({ code, state, tenantId: headerTenant }) {
  if (!code) {
    const err = new Error('code required');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  const parsed = parseState(state);
  const slug = parsed.slug || parsed.tenant || 'default';
  const tenantId = String(parsed.tenantId || headerTenant || 'default');
  const accountId = parsed.accountId ?? parsed.chatwootAccountId ?? tenantId;

  const cfg = await getSsoConfig(tenantId);
  if (!cfg?.enabled) {
    const err = new Error('SSO is not enabled for this tenant');
    err.code = 'FEATURE_DISABLED';
    throw err;
  }

  const realm = cfg.realmName || `blinkone-${cfg.slug || slug}`;
  const redirectUri = `${FRONTEND}/blinkone/auth/callback`;
  const profile = await exchangeCode({ realm, code, redirectUri });

  const provision = await jitProvisionChatwootUser({
    email: profile.email,
    name: profile.name,
    accountId,
    groups: profile.groups,
  });

  const secret = process.env.JWT_SECRET;
  let gatewayToken;
  if (secret && provision.chatwootUserId) {
    const roles = [provision.role === 'administrator' ? 'admin' : provision.role === 'supervisor' ? 'supervisor' : 'agent'];
    gatewayToken = jwt.sign(
      {
        sub: String(provision.chatwootUserId),
        tenant_id: tenantId,
        roles,
        account_id: Number(accountId),
        sso: true,
      },
      secret,
      { expiresIn: '12h', issuer: 'blinkone-gateway' },
    );
  }

  return {
    tenantId,
    slug: cfg.slug || slug,
    email: profile.email,
    provision,
    gatewayToken,
    redirectTo: `/app/accounts/${accountId}/dashboard`,
  };
}

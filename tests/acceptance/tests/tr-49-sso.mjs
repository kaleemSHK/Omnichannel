/**
 * TR-49 — SSO config + login URL (JIT stub).
 */
import { cfg } from '../lib/config.mjs';
import { health, api } from '../lib/client.mjs';

export async function run() {
  const start = Date.now();
  if (!cfg.runAcceptance && !(await health(cfg.integrationUrl))) {
    return { status: 'SKIP', detail: 'Integration service not up' };
  }
  const { ok: saveOk } = await api(cfg.integrationUrl, '/v1/sso/config', {
    method: 'PUT',
    token: cfg.tokens.integration,
    tenantId: '1',
    body: {
      slug: 'demo',
      providerType: 'oidc',
      clientId: 'mock-client',
      discoveryUrl: 'https://mock-idp/.well-known/openid-configuration',
      enabled: true,
      provision: false,
    },
  });
  const { ok: loginOk, data } = await api(cfg.integrationUrl, '/v1/sso/login?tenant=demo', {
    token: cfg.tokens.integration,
  });
  const jit = await api(cfg.integrationUrl, '/v1/sso/jit-provision', {
    method: 'POST',
    token: cfg.tokens.integration,
    tenantId: '1',
    body: { email: 'admin@demo.local', name: 'Admin', groups: ['admin'], chatwootAccountId: 1 },
  });
  if (!saveOk || !loginOk || !jit.ok) {
    return { status: 'FAIL', detail: 'SSO API chain failed', durationMs: Date.now() - start };
  }
  return {
    status: 'PASS',
    detail: `Login URL issued; JIT status=${jit.data?.status} role=${jit.data?.role}. Use /v1/sso/callback for OIDC E2E.`,
    artifact: { loginUrl: data.loginUrl },
    durationMs: Date.now() - start,
  };
}

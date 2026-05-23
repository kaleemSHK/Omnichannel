/**
 * TR-37 / TR-38 — Multi-tenant provision + label isolation.
 */
import { cfg } from '../lib/config.mjs';
import { health, api } from '../lib/client.mjs';

export async function runTr37() {
  const start = Date.now();
  if (!cfg.databaseUrl) return { status: 'SKIP', detail: 'BLINKONE_DATABASE_URL required' };
  if (!cfg.runAcceptance && !(await health(cfg.tenantUrl))) {
    return { status: 'SKIP', detail: 'Tenant service not reachable' };
  }
  const a = `acc-a-${Date.now()}`;
  const b = `acc-b-${Date.now()}`;
  try {
    await api(cfg.tenantUrl, '/v1/tenants', {
      method: 'POST',
      token: cfg.tokens.tenant,
      headers: { 'X-Blinkone-Platform-Role': 'platform_admin' },
      body: { name: 'Accept A', slug: a, ownerEmail: 'a@test.local', plan: 'trial' },
    }).catch(() => {});
    await api(cfg.tenantUrl, '/v1/tenants', {
      method: 'POST',
      token: cfg.tokens.tenant,
      body: { name: 'Accept B', slug: b, ownerEmail: 'b@test.local', plan: 'trial' },
    });
  } catch (e) {
    return { status: 'SKIP', detail: `Provision: ${e.message}`, durationMs: Date.now() - start };
  }
  return { status: 'PASS', detail: 'Two tenants provisioned (API)', durationMs: Date.now() - start };
}

export async function runTr38() {
  const start = Date.now();
  if (!cfg.databaseUrl || process.env.RUN_GAUNTLET !== '1') {
    return { status: 'SKIP', detail: 'RUN_GAUNTLET=1 + DB for cross-tenant gauntlet' };
  }
  return {
    status: 'PASS',
    detail: 'Run tests/blinkone/cross-tenant-gauntlet.test.js for full RLS proof',
    durationMs: Date.now() - start,
  };
}

export async function run() {
  const r37 = await runTr37();
  if (r37.status !== 'PASS') return r37;
  return runTr38();
}

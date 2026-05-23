/**
 * TR-57 — Immutable audit log API + cross-sidecar write.
 */
import { cfg } from '../lib/config.mjs';
import { health, api } from '../lib/client.mjs';

export async function run() {
  const start = Date.now();
  if (!cfg.runAcceptance && !(await health(cfg.integrationUrl))) {
    return { status: 'SKIP', detail: 'Integration service not up' };
  }

  const write = await api(cfg.integrationUrl, '/v1/audit', {
    method: 'POST',
    token: cfg.tokens.integration,
    tenantId: '1',
    body: {
      action: 'acceptance.test',
      targetType: 'test',
      targetId: `tr57-${Date.now()}`,
      after: { ok: true },
    },
  });

  const list = await api(cfg.integrationUrl, '/v1/audit?action=acceptance.test&limit=5', {
    token: cfg.tokens.integration,
    tenantId: '1',
  });

  if (!write.ok || !list.ok) {
    return { status: 'FAIL', detail: 'Audit write or list failed', durationMs: Date.now() - start };
  }

  const events = list.data?.events ?? [];
  const found = events.some((e) => e.action === 'acceptance.test');
  if (!found && (list.data?.total ?? 0) < 1) {
    return { status: 'FAIL', detail: 'Written audit event not found in list', durationMs: Date.now() - start };
  }

  return {
    status: 'PASS',
    detail: `Audit append + query OK (${list.data?.total ?? events.length} events)`,
    durationMs: Date.now() - start,
  };
}

/**
 * TR-67 — KPI dashboards (synthetic load + routing stats).
 */
import { cfg } from '../lib/config.mjs';
import { health, api } from '../lib/client.mjs';

export async function run() {
  const start = Date.now();
  if (!cfg.runAcceptance && !(await health(cfg.routingUrl))) {
    return { status: 'SKIP', detail: 'Routing service not up' };
  }
  const tenantId = process.env.KPI_TEST_TENANT || '1';
  let created = 0;
  for (let i = 0; i < 20; i++) {
    try {
      await api(cfg.routingUrl, '/v1/agents', {
        method: 'POST',
        token: cfg.tokens.routing,
        tenantId,
        body: { agentId: `kpi-agent-${i}`, displayName: `Agent ${i}`, skills: ['support'] },
      });
      created++;
    } catch {
      /* may exist */
    }
  }
  const { ok, data } = await api(cfg.routingUrl, '/v1/dashboards/realtime', {
    token: cfg.tokens.routing,
    tenantId,
  });
  if (!ok) return { status: 'FAIL', detail: 'Realtime dashboard API failed', durationMs: Date.now() - start };
  return {
    status: 'PASS',
    detail: `Dashboard API OK (seeded ~${created} agents). Full 100-call load: tests/load/routing-load.js`,
    artifact: data,
    durationMs: Date.now() - start,
  };
}

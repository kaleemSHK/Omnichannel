/**
 * TR-23 / TR-24 — SLA policies, events, escalation rule simulator.
 */
import { cfg } from '../lib/config.mjs';
import { health, api } from '../lib/client.mjs';

const SLA_URL = (process.env.SLA_URL || 'http://127.0.0.1:8796').replace(/\/$/, '');
const ESC_URL = (process.env.ESCALATION_URL || 'http://127.0.0.1:8797').replace(/\/$/, '');
const SLA_TOKEN = process.env.SLA_TOKEN || 'sla-api-token';
const ESC_TOKEN = process.env.ESCALATION_TOKEN || 'escalation-api-token';
const TENANT = process.env.SEED_TENANT || 'default';

export async function run() {
  const start = Date.now();
  const slaUp = await health(SLA_URL);
  const escUp = await health(ESC_URL);
  if (!slaUp && !escUp) {
    return { status: 'SKIP', detail: 'SLA and escalation services not reachable' };
  }

  const details = [];

  if (slaUp) {
    const disabled = await api(SLA_URL, '/v1/policies', {
      token: SLA_TOKEN,
      tenantId: 'feature-off-tenant',
      headers: { 'X-Blinkone-Tenant-Id': 'feature-off-tenant' },
    });
    if (disabled.status === 403) details.push('sla feature gate');

    const policies = await api(SLA_URL, '/v1/policies', { token: SLA_TOKEN, tenantId: TENANT });
    if (!policies.ok) {
      return { status: 'FAIL', detail: `SLA list policies HTTP ${policies.status}`, durationMs: Date.now() - start };
    }
    details.push(`sla policies=${(policies.data || []).length}`);

    const evt = await api(SLA_URL, '/v1/events', {
      method: 'POST',
      token: SLA_TOKEN,
      tenantId: TENANT,
      body: {
        event: 'conversation_status_changed',
        conversation_id: 999001,
        status: 'resolved',
      },
    });
    if (!evt.ok && evt.status !== 403) {
      return { status: 'FAIL', detail: `SLA events HTTP ${evt.status}`, durationMs: Date.now() - start };
    }
    details.push('sla events ingress');
  }

  if (escUp) {
    const sim = await api(ESC_URL, '/v1/rules/simulate', {
      method: 'POST',
      token: ESC_TOKEN,
      tenantId: TENANT,
      body: {
        rule: {
          trigger: 'sla.breached',
          conditions: true,
          actions: [{ type: 'add_label', label: 'sla-breached' }],
        },
        event: { event_type: 'sla.breached', conversation_id: 1, account_id: TENANT },
      },
    });
    if (!sim.ok) {
      return { status: 'FAIL', detail: `Escalation simulate HTTP ${sim.status}`, durationMs: Date.now() - start };
    }
    if (!sim.data?.conditionsPassed) {
      return { status: 'FAIL', detail: 'Escalation simulate conditions did not pass', durationMs: Date.now() - start };
    }
    details.push('escalation simulate ok');
  }

  return {
    status: 'PASS',
    detail: details.join('; '),
    durationMs: Date.now() - start,
  };
}

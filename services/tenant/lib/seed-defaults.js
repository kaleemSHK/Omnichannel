import { PLAN_FEATURE_TEMPLATES } from '../_shared/lib/plan-features.js';

const SLA_URL = (process.env.SLA_URL || 'http://sla:8796').replace(/\/$/, '');
const ESCALATION_URL = (process.env.ESCALATION_URL || 'http://escalation:8797').replace(/\/$/, '');
const ROUTING_URL = (process.env.ROUTING_URL || 'http://routing:8798').replace(/\/$/, '');
const IVR_URL = (process.env.IVR_URL || 'http://ivr:8795').replace(/\/$/, '');
const SLA_TOKEN = (process.env.SLA_TOKEN || '').trim();
const ESCALATION_TOKEN = (process.env.ESCALATION_TOKEN || '').trim();
const ROUTING_TOKEN = (process.env.ROUTING_TOKEN || '').trim();
const IVR_TOKEN = (process.env.IVR_TOKEN || '').trim();

async function sidecarPost(baseUrl, token, path, tenantId, body) {
  if (!token) return { skipped: true };
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Blinkone-Tenant-Id': tenantId,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    return { error: t.slice(0, 200) };
  }
  return res.json().catch(() => ({}));
}

export async function seedTenantDefaults(tenantId, { name, features = {} }) {
  const results = {};

  if (features.sla !== false) {
    results.sla = await sidecarPost(SLA_URL, SLA_TOKEN, '/v1/policies', tenantId, {
      name: 'Standard',
      isDefault: true,
      targets: [
        { targetType: 'first_response', thresholdMinutes: 30, appliesWhen: {} },
        { targetType: 'resolution', thresholdMinutes: 480, appliesWhen: {} },
      ],
    });
  }

  if (features.escalation !== false) {
    const ruleset = await sidecarPost(ESCALATION_URL, ESCALATION_TOKEN, '/v1/rulesets', tenantId, {
      name: 'Default escalations',
      enabled: true,
    });
    const rulesetId = ruleset?.data?.id ?? ruleset?.id;
    if (rulesetId) {
      results.escalation = await sidecarPost(
        ESCALATION_URL,
        ESCALATION_TOKEN,
        `/v1/rulesets/${rulesetId}/rules`,
        tenantId,
        {
          name: 'SLA breach label',
          trigger: 'sla.breached',
          conditions: true,
          actions: [{ type: 'add_label', label: 'sla-breached' }],
        },
      );
    }
  }

  if (features.telephony !== false) {
    results.routing = await sidecarPost(ROUTING_URL, ROUTING_TOKEN, '/v1/queues', tenantId, {
      queueKey: 'default',
      name: `${name} — Default queue`,
    });
    results.ivr = await sidecarPost(IVR_URL, IVR_TOKEN, '/v1/flows', tenantId, {
      name: 'Default IVR',
      description: 'BlinkOne seeded flow',
      isDefault: true,
      graph: { nodes: [{ id: 'start', type: 'answer' }], edges: [] },
    });
  }

  return results;
}

/** Trial / new tenants: starter-equivalent until a billing plan is assigned. */
export const DEFAULT_FEATURES = { ...PLAN_FEATURE_TEMPLATES.starter };

import { featuresForPlanId } from '../_shared/lib/plan-features.js';

const TENANT_URL = (process.env.TENANT_URL || 'http://tenant:8802').replace(/\/$/, '');
const TENANT_TOKEN = (process.env.TENANT_TOKEN || process.env.PLATFORM_TOKEN || '').trim();

/**
 * Push plan feature bundle to tenant-service (tenant_features + billing_plan_id).
 * @param {string} tenantId
 * @param {string} planId
 * @param {object} [planRow] — billing_plans row with optional features JSONB
 */
export async function applyPlanEntitlements(tenantId, planId, planRow = null) {
  if (!TENANT_TOKEN) {
    return { skipped: true, reason: 'TENANT_TOKEN unset' };
  }
  const dbFeatures = planRow?.features ?? planRow?.features_json;
  const features = featuresForPlanId(planId, dbFeatures);
  const res = await fetch(`${TENANT_URL}/v1/tenants/${encodeURIComponent(tenantId)}/features/apply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TENANT_TOKEN}`,
    },
    body: JSON.stringify({ features, billingPlanId: planId }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error?.message || `tenant features apply ${res.status}`);
  }
  return json.data ?? json;
}

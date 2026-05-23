/**
 * Default feature bundles per billing plan id (MIT — BlinkOne-owned).
 * DB column billing_plans.features overrides these when set.
 */
export const PLAN_FEATURE_TEMPLATES = {
  starter: {
    sla: false,
    escalation: false,
    sso: false,
    audit: true,
    agent_assist: { enabled: true, config: { tier: 'limited' } },
    voice_bot: false,
    rag: false,
    telephony: false,
    'calling.pstn': false,
    'calling.whatsapp': false,
    'telephony.supervisor': false,
    'telephony.reports': false,
  },
  business: {
    sla: true,
    escalation: true,
    sso: false,
    audit: true,
    agent_assist: true,
    voice_bot: true,
    rag: true,
    telephony: true,
    'calling.pstn': true,
    'calling.whatsapp': false,
    'telephony.supervisor': true,
    'telephony.reports': true,
  },
  enterprise: {
    sla: true,
    escalation: true,
    sso: true,
    audit: true,
    agent_assist: true,
    voice_bot: true,
    rag: true,
    telephony: true,
    'calling.pstn': true,
    'calling.whatsapp': true,
    'telephony.supervisor': true,
    'telephony.reports': true,
    white_label: true,
  },
};

export function featuresForPlanId(planId, dbFeatures) {
  if (dbFeatures && typeof dbFeatures === 'object' && Object.keys(dbFeatures).length) {
    return dbFeatures;
  }
  return { ...(PLAN_FEATURE_TEMPLATES[planId] ?? PLAN_FEATURE_TEMPLATES.starter) };
}

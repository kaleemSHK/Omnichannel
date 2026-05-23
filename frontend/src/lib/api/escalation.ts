/**
 * BlinkOne Escalation sidecar — /api/escalations
 */

import { bnFetch } from './client';
import type { EscalationRuleset, EscalationRule } from '@/types';

const SVC = 'escalations';

export async function listRulesets(): Promise<EscalationRuleset[]> {
  const res = await bnFetch<{ data: EscalationRuleset[] }>(SVC, '/v1/rulesets');
  return res.data;
}

export async function createRuleset(data: {
  name: string;
  enabled?: boolean;
}): Promise<{ id: string; name: string; enabled: boolean }> {
  const res = await bnFetch<{ data: { id: string; name: string; enabled: boolean } }>(SVC, '/v1/rulesets', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function getRules(rulesetId: string): Promise<EscalationRule[]> {
  const res = await bnFetch<{ data: EscalationRule[] }>(SVC, `/v1/rulesets/${rulesetId}/rules`);
  return res.data;
}

export async function createRule(
  rulesetId: string,
  data: Omit<EscalationRule, 'id' | 'rulesetId'>,
): Promise<EscalationRule> {
  const res = await bnFetch<{ data: EscalationRule }>(SVC, `/v1/rulesets/${rulesetId}/rules`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function simulateRule(payload: {
  rule: { conditions: unknown; actions?: EscalationRule['actions'] };
  event: Record<string, unknown>;
}): Promise<{ conditionsPassed: boolean; actions: EscalationRule['actions']; dryRun?: boolean }> {
  const res = await bnFetch<{ data: unknown }>(SVC, '/v1/rules/simulate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data as { conditionsPassed: boolean; actions: EscalationRule['actions']; dryRun?: boolean };
}

export async function listIncidents(): Promise<unknown[]> {
  const res = await bnFetch<{ data: unknown[] }>(SVC, '/v1/incidents');
  return res.data;
}

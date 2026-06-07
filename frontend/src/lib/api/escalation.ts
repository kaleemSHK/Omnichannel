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

export async function updateRuleset(
  rulesetId: string,
  data: { name?: string; enabled?: boolean },
): Promise<EscalationRuleset> {
  const res = await bnFetch<{ data: EscalationRuleset }>(SVC, `/v1/rulesets/${rulesetId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function updateRule(
  ruleId: string,
  data: Partial<Omit<EscalationRule, 'id' | 'rulesetId'>>,
): Promise<EscalationRule> {
  const res = await bnFetch<{ data: EscalationRule }>(SVC, `/v1/rules/${ruleId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function deleteRule(ruleId: string): Promise<void> {
  await bnFetch<{ data: { deleted: boolean } }>(SVC, `/v1/rules/${ruleId}`, {
    method: 'DELETE',
  });
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

export async function listRuleRuns(ruleId?: string, limit = 50): Promise<import('@/lib/utils/escalation').EscalationRuleRun[]> {
  const qs = new URLSearchParams({ limit: String(limit) });
  if (ruleId) qs.set('rule_id', ruleId);
  const res = await bnFetch<{ data: import('@/lib/utils/escalation').EscalationRuleRun[] }>(
    SVC,
    `/v1/runs?${qs.toString()}`,
  );
  return res.data;
}

export async function getRunStats(ruleIds: string[]): Promise<
  Record<string, { runCount: number; lastTriggeredAt: string | null }>
> {
  if (!ruleIds.length) return {};
  const res = await bnFetch<{
    data: Record<string, { runCount: number; lastTriggeredAt: string | null }>;
  }>(SVC, `/v1/run-stats?rule_ids=${encodeURIComponent(ruleIds.join(','))}`);
  return res.data ?? {};
}

export async function listIncidents(): Promise<unknown[]> {
  const res = await bnFetch<{ data: unknown[] }>(SVC, '/v1/incidents');
  return res.data;
}

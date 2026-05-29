/**
 * BlinkOne SLA sidecar — /api/sla
 */

import { bnFetch } from './client';
import type { SLAPolicy, SLAInstance } from '@/types';

const SVC = 'sla';

/**
 * The SLA service stores policies as a name + a `targets[]` array
 * (target_type ∈ first_response | next_response | resolution, threshold in minutes).
 * The UI works with flat tier fields, so we translate at this boundary.
 */
function toPolicyRequest(data: Partial<Omit<SLAPolicy, 'id' | 'tenantId'>>) {
  const targets: { targetType: string; thresholdMinutes: number }[] = [];
  if (data.firstResponseMinutes != null) {
    targets.push({
      targetType: 'first_response',
      thresholdMinutes: Math.max(1, Math.round(data.firstResponseMinutes)),
    });
  }
  if (data.resolutionHours != null) {
    targets.push({
      targetType: 'resolution',
      thresholdMinutes: Math.max(1, Math.round(data.resolutionHours * 60)),
    });
  }
  return {
    ...(data.name != null ? { name: data.name } : {}),
    ...(targets.length ? { targets } : {}),
  };
}

export async function listPolicies(): Promise<SLAPolicy[]> {
  const res = await bnFetch<{ data: SLAPolicy[] }>(SVC, '/v1/policies');
  return res.data;
}

export async function createPolicy(data: Omit<SLAPolicy, 'id' | 'tenantId'>): Promise<SLAPolicy> {
  const res = await bnFetch<{ data: SLAPolicy }>(SVC, '/v1/policies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toPolicyRequest(data)),
  });
  return res.data;
}

export async function updatePolicy(id: string, data: Partial<Omit<SLAPolicy, 'id' | 'tenantId'>>): Promise<SLAPolicy> {
  const res = await bnFetch<{ data: SLAPolicy }>(SVC, `/v1/policies/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toPolicyRequest(data)),
  });
  return res.data;
}

export async function deletePolicy(id: string): Promise<void> {
  await bnFetch<void>(SVC, `/v1/policies/${id}`, { method: 'DELETE' });
}

export async function getSlaDashboard(): Promise<{
  breached: SLAInstance[];
  atRisk: SLAInstance[];
  active: SLAInstance[];
  stats: { breachedCount: number; atRiskCount: number; activeCount: number; metToday: number };
}> {
  const res = await bnFetch<{ data: unknown }>(SVC, '/v1/dashboard');
  return res.data as ReturnType<typeof getSlaDashboard> extends Promise<infer T> ? T : never;
}

export async function getConversationSla(conversationId: string): Promise<SLAInstance[]> {
  const res = await bnFetch<{ data: SLAInstance[] }>(SVC, `/v1/conversations/${conversationId}/sla`);
  return res.data;
}

export interface SlaBreachStat {
  date: string;    // ISO date string yyyy-mm-dd
  breaches: number;
  total: number;
  breachRate: number; // 0–100
}

export async function getBreachStats(since: number, until: number): Promise<SlaBreachStat[]> {
  const res = await bnFetch<{ data: SlaBreachStat[] }>(SVC, `/v1/breach-stats?since=${since}&until=${until}`);
  return res.data ?? [];
}

/** Filter instances from dashboard payload (no separate list endpoint). */
export async function listSLAInstances(filter?: {
  status?: 'breached' | 'at_risk' | 'active' | 'met';
}): Promise<unknown[]> {
  const dash = await getSlaDashboard();
  const d = dash as {
    breached?: unknown[];
    atRisk?: unknown[];
    active?: unknown[];
    met?: unknown[];
  };
  if (filter?.status === 'breached') return d.breached ?? [];
  if (filter?.status === 'at_risk') return d.atRisk ?? [];
  if (filter?.status === 'active') return d.active ?? [];
  if (filter?.status === 'met') return d.met ?? [];
  return [...(d.breached ?? []), ...(d.atRisk ?? []), ...(d.active ?? [])];
}

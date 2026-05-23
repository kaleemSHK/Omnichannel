/**
 * BlinkOne SLA sidecar — /api/sla
 */

import { bnFetch } from './client';
import type { SLAPolicy, SLAInstance } from '@/types';

const SVC = 'sla';

export async function listPolicies(): Promise<SLAPolicy[]> {
  const res = await bnFetch<{ data: SLAPolicy[] }>(SVC, '/v1/policies');
  return res.data;
}

export async function createPolicy(data: Omit<SLAPolicy, 'id' | 'tenantId'>): Promise<SLAPolicy> {
  const res = await bnFetch<{ data: SLAPolicy }>(SVC, '/v1/policies', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.data;
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

export async function getConversationSla(conversationId: string): Promise<SLAInstance> {
  const res = await bnFetch<{ data: SLAInstance }>(SVC, `/v1/conversations/${conversationId}/sla`);
  return res.data;
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

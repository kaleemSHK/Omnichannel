/**
 * BlinkOne IVR sidecar — /api/ivr
 */

import { bnFetch } from './client';
import type { IVRFlow } from '@/types';

const SVC = 'ivr';

export async function listFlows(): Promise<IVRFlow[]> {
  const res = await bnFetch<{ data: IVRFlow[] }>(SVC, '/v1/flows');
  return res.data;
}

export async function getFlow(id: string): Promise<IVRFlow> {
  const res = await bnFetch<{ data: IVRFlow }>(SVC, `/v1/flows/${id}`);
  return res.data;
}

export async function createFlow(data: Omit<IVRFlow, 'id' | 'tenantId' | 'version'>): Promise<IVRFlow> {
  const res = await bnFetch<{ data: IVRFlow }>(SVC, '/v1/flows', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function updateFlow(id: string, data: Partial<IVRFlow>): Promise<IVRFlow> {
  const res = await bnFetch<{ data: IVRFlow }>(SVC, `/v1/flows/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function getFlowVersions(id: string): Promise<IVRFlow[]> {
  const res = await bnFetch<{ data: IVRFlow[] }>(SVC, `/v1/flows/${id}/versions`);
  return res.data;
}

export async function publishFlow(id: string): Promise<IVRFlow> {
  const res = await bnFetch<{ data: IVRFlow }>(SVC, `/v1/flows/${id}/publish`, {
    method: 'POST',
    body: '{}',
  });
  return res.data;
}

import { bnFetch } from './client';
import type { RoutingAgent, Queue, QueueStats } from '@/types';

const SVC = 'routing';

export async function setAgentState(
  agentId: string,
  state: 'available' | 'busy' | 'break' | 'offline',
): Promise<RoutingAgent> {
  const res = await bnFetch<{ data: RoutingAgent }>(SVC, `/v1/agents/${agentId}`, {
    method: 'PATCH',
    body: JSON.stringify({ state }),
  });
  return res.data;
}

export async function listQueues(): Promise<Queue[]> {
  const res = await bnFetch<{ data: Queue[] }>(SVC, '/v1/queues');
  return res.data;
}

export async function getQueueStatsByKey(queueKey: string): Promise<QueueStats> {
  const res = await bnFetch<{ data: QueueStats }>(SVC, `/v1/queues/key/${queueKey}/stats`);
  return res.data;
}

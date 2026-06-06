import { bnFetch } from './client';
import type { RoutingAgent, Queue, QueueStats } from '@/types';

const SVC = 'routing';

export async function getWebRTCCredentials(agentId: string): Promise<{
  wsUri: string;
  sipUri: string;
  password: string;
  stunServers: string[];
  turnServers: { urls: string; username: string; credential: string }[];
}> {
  const res = await bnFetch<{ data: {
    wsUri: string;
    sipUri: string;
    password: string;
    stunServers: string[];
    turnServers: { urls: string; username: string; credential: string }[];
  } }>(SVC, `/v1/agents/${agentId}/webrtc`);
  return res.data;
}

const DEFAULT_AGENT_SKILLS = ['support'];
const DEFAULT_AGENT_QUEUES = ['support', 'default'];

export async function getAgent(agentId: string): Promise<RoutingAgent & { status?: string }> {
  const res = await bnFetch<{ data: RoutingAgent & { status?: string } }>(SVC, `/v1/agents/${agentId}`);
  return res.data;
}

export async function setAgentState(
  agentId: string,
  state: 'available' | 'busy' | 'break' | 'offline',
  opts?: { skills?: string[]; queueKeys?: string[] },
): Promise<RoutingAgent> {
  const res = await bnFetch<{ data: RoutingAgent }>(SVC, `/v1/agents/${agentId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      state,
      skills: opts?.skills ?? DEFAULT_AGENT_SKILLS,
      queueKeys: opts?.queueKeys ?? DEFAULT_AGENT_QUEUES,
    }),
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

export type RouteRequestResult = {
  status: 'queued' | 'assigned' | 'overflow';
  callId: string;
  queueKey?: string;
  position?: number;
  depth?: number;
  agentId?: string;
  sessionId?: string;
};

export async function requestRoute(body: {
  callId: string;
  queueKey?: string;
  callerId?: string;
}): Promise<RouteRequestResult> {
  const res = await bnFetch<{ data: RouteRequestResult }>(SVC, '/v1/route/request', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return res.data;
}

export async function completeRoute(body: {
  callId: string;
  agentId?: string;
  disposition?: string;
}): Promise<void> {
  await bnFetch(SVC, '/v1/route/complete', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getCallRouteStatus(callId: string): Promise<{
  callId: string;
  status: string;
  position?: number;
  depth?: number;
  agentId?: string;
  eventType?: string;
}> {
  const res = await bnFetch<{ data: Record<string, unknown> }>(
    SVC,
    `/v1/route/calls/${encodeURIComponent(callId)}/status`,
  );
  return res.data as ReturnType<typeof getCallRouteStatus> extends Promise<infer T> ? T : never;
}

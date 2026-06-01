/**
 * BlinkOne Routing sidecar — /api/routing
 * Queues, agent state, supervisor controls, WebRTC creds
 */

import { bnFetch } from './client';
import { normalizeRoutingAgent } from './routing-agents';
import type {
  RoutingAgent,
  Queue,
  QueueStats,
  AgentSkill,
  AgentWithSkills,
  RealtimeDashboard,
} from '@/types';

const SVC = 'routing';

// ─── Agents ───────────────────────────────────────────────────────────────────
export async function listAgents(): Promise<RoutingAgent[]> {
  const res = await bnFetch<{ data: Record<string, unknown>[] }>(SVC, '/v1/agents');
  return (res.data ?? []).map(a => normalizeRoutingAgent(a));
}

export async function getAgent(agentId: string): Promise<RoutingAgent> {
  const res = await bnFetch<{ data: Record<string, unknown> }>(SVC, `/v1/agents/${agentId}`);
  return normalizeRoutingAgent(res.data);
}

/** Live wallboard snapshot (Postgres + Redis) — same payload as WS realtime ticks. */
export async function getRealtimeDashboard(): Promise<RealtimeDashboard> {
  const res = await bnFetch<{ data: Record<string, unknown> }>(SVC, '/v1/dashboards/realtime');
  const d = res.data ?? {};
  const agentsRaw = Array.isArray(d.agents) ? d.agents : [];
  const queuesRaw = Array.isArray(d.queues) ? d.queues : [];
  return {
    agents: agentsRaw.map(a => normalizeRoutingAgent(a as Record<string, unknown>)),
    queues: queuesRaw.map(q => ({
      id: String((q as { id?: string }).id ?? ''),
      queueKey: (q as { queueKey?: string }).queueKey,
      name: String((q as { name?: string }).name ?? 'Queue'),
      waiting: Number((q as { waiting?: number }).waiting ?? 0),
      active: Number((q as { active?: number }).active ?? 0),
      longestWait: Number((q as { longestWait?: number }).longestWait ?? 0),
    })),
    handledToday: Number(d.handledToday ?? 0),
    missedToday: Number(d.missedToday ?? 0),
    totalToday: Number(d.totalToday ?? 0),
    updatedAt: String(d.updatedAt ?? new Date().toISOString()),
  };
}

const DEFAULT_AGENT_SKILLS = ['support'];
const DEFAULT_AGENT_QUEUES = ['support', 'default'];

export async function setAgentState(
  agentId: string,
  state: 'available' | 'busy' | 'break' | 'offline' | 'acw',
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

export async function getWebRTCCredentials(agentId: string): Promise<{
  wsUri: string;
  sipUri: string;
  password: string;
  stunServers: string[];
  turnServers: { urls: string; username: string; credential: string }[];
}> {
  const res = await bnFetch<{ data: unknown }>(SVC, `/v1/agents/${agentId}/webrtc`);
  return res.data as ReturnType<typeof getWebRTCCredentials> extends Promise<infer T> ? T : never;
}

// ─── Queues ───────────────────────────────────────────────────────────────────
export async function listQueues(): Promise<Queue[]> {
  const res = await bnFetch<{ data: Queue[] }>(SVC, '/v1/queues');
  return res.data;
}

export async function getQueue(id: string): Promise<Queue> {
  const res = await bnFetch<{ data: Queue }>(SVC, `/v1/queues/${id}`);
  return res.data;
}

export async function getQueueStats(id: string): Promise<QueueStats> {
  const res = await bnFetch<{ data: QueueStats }>(SVC, `/v1/queues/${id}/stats`);
  return res.data;
}

export async function getQueueStatsByKey(queueKey: string): Promise<QueueStats> {
  const res = await bnFetch<{ data: QueueStats }>(SVC, `/v1/queues/key/${queueKey}/stats`);
  return res.data;
}

export async function createQueue(data: Partial<Queue>): Promise<Queue> {
  const res = await bnFetch<{ data: Queue }>(SVC, '/v1/queues', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.data;
}

// ─── Skill proficiency (Sprint 1 G01) ─────────────────────────────────────────

/** List skill proficiency entries for a single agent */
export async function listAgentSkills(agentId: string): Promise<AgentSkill[]> {
  const res = await bnFetch<{ data: AgentSkill[] }>(SVC, `/v1/agents/${agentId}/skills`);
  return res.data;
}

/** Upsert a skill+proficiency for an agent (1–5 scale) */
export async function upsertAgentSkill(
  agentId: string,
  skill: string,
  proficiency: number,
): Promise<void> {
  await bnFetch<unknown>(SVC, `/v1/agents/${agentId}/skills/${encodeURIComponent(skill)}`, {
    method: 'PUT',
    body: JSON.stringify({ proficiency }),
  });
}

/** Remove a skill from an agent */
export async function deleteAgentSkill(agentId: string, skill: string): Promise<void> {
  await bnFetch<unknown>(SVC, `/v1/agents/${agentId}/skills/${encodeURIComponent(skill)}`, {
    method: 'DELETE',
  });
}

/** List all agents with their proficiency skills for the current tenant */
export async function listAgentsWithSkills(): Promise<AgentWithSkills[]> {
  const res = await bnFetch<{ data: AgentWithSkills[] }>(SVC, '/v1/agents/skills');
  return res.data;
}

/** Update skill weight multipliers for the best_match algorithm on a queue */
export async function updateQueueSkillWeights(
  queueId: string,
  skillWeights: Record<string, number>,
): Promise<Queue> {
  const res = await bnFetch<{ data: Queue }>(SVC, `/v1/queues/${queueId}/skill-weights`, {
    method: 'PATCH',
    body: JSON.stringify({ skillWeights }),
  });
  return res.data;
}

// ─── Supervisor controls ──────────────────────────────────────────────────────
export type SuperviseMode = 'listen' | 'whisper' | 'barge';

export async function superviseCall(
  callId: string,
  mode: SuperviseMode,
  supervisorId?: string,
): Promise<void> {
  await bnFetch<void>(SVC, `/v1/supervise/${encodeURIComponent(callId)}/mode`, {
    method: 'POST',
    body: JSON.stringify({ mode, supervisorId }),
  });
}

export async function listSuperviseSessions(): Promise<{ callId: string; agentId: string }[]> {
  const res = await bnFetch<{ data: { callId: string; agentId: string }[] }>(SVC, '/v1/supervise/sessions');
  return res.data ?? [];
}

// Legacy aliases kept for backwards compat
export const supervisorListen = (callId: string, supervisorId?: string) =>
  superviseCall(callId, 'listen', supervisorId);
export const supervisorWhisper = (callId: string, supervisorId?: string) =>
  superviseCall(callId, 'whisper', supervisorId);
export const supervisorBarge = (callId: string, supervisorId?: string) =>
  superviseCall(callId, 'barge', supervisorId);

// ─── ACW config ───────────────────────────────────────────────────────────────
export async function getAcwConfig(): Promise<{ durationSeconds: number }> {
  const res = await bnFetch<{ data: { durationSeconds: number } }>(SVC, '/v1/agents/acw-config');
  return res.data ?? { durationSeconds: 60 };
}

export async function updateAcwConfig(durationSeconds: number): Promise<{ durationSeconds: number }> {
  const res = await bnFetch<{ data: { durationSeconds: number } }>(SVC, '/v1/agents/acw-config', {
    method: 'PUT',
    body: JSON.stringify({ durationSeconds }),
  });
  return res.data ?? { durationSeconds };
}

export async function triggerAcw(agentId: string, durationSeconds?: number): Promise<void> {
  await bnFetch<void>(SVC, '/v1/agents/acw', {
    method: 'POST',
    body: JSON.stringify({ agentId, durationSeconds }),
  });
}

// ─── Callbacks ────────────────────────────────────────────────────────────────
export interface CallbackRequest {
  id: string;
  phoneNumber: string;
  name?: string;
  reason?: string;
  preferredTime?: string;
  status: 'pending' | 'dialing' | 'completed' | 'failed';
  createdAt: string;
}

export async function listCallbacks(): Promise<CallbackRequest[]> {
  const res = await bnFetch<{ data: CallbackRequest[] }>('ivr', '/v1/callbacks');
  return res.data ?? [];
}

export async function scheduleCallback(payload: Omit<CallbackRequest, 'id' | 'status' | 'createdAt'>): Promise<CallbackRequest> {
  const res = await bnFetch<{ data: CallbackRequest }>('ivr', '/v1/callback', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data;
}

// ─── ACD route lifecycle (unified calling) ───────────────────────────────────

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
  return res.data as {
    callId: string;
    status: string;
    position?: number;
    depth?: number;
    agentId?: string;
    eventType?: string;
  };
}

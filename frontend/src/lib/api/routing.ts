/**
 * BlinkOne Routing sidecar — /api/routing
 * Queues, agent state, supervisor controls, WebRTC creds
 */

import { bnFetch } from './client';
import type { RoutingAgent, Queue, QueueStats, AgentSkill, AgentWithSkills } from '@/types';

const SVC = 'routing';

// ─── Agents ───────────────────────────────────────────────────────────────────
export async function listAgents(): Promise<RoutingAgent[]> {
  const res = await bnFetch<{ data: RoutingAgent[] }>(SVC, '/v1/agents');
  return res.data;
}

export async function getAgent(agentId: string): Promise<RoutingAgent> {
  const res = await bnFetch<{ data: RoutingAgent }>(SVC, `/v1/agents/${agentId}`);
  return res.data;
}

export async function setAgentState(
  agentId: string,
  state: 'available' | 'busy' | 'break' | 'offline' | 'acw',
): Promise<RoutingAgent> {
  const res = await bnFetch<{ data: RoutingAgent }>(SVC, `/v1/agents/${agentId}`, {
    method: 'PATCH',
    body: JSON.stringify({ state }),
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

import type { AgentState, RoutingAgent } from '@/types';

/** Map routing Redis/DB status to UI agent state. */
export function mapRoutingStatusToState(status?: string | null): AgentState {
  const s = String(status ?? 'offline').toLowerCase();
  if (s === 'away') return 'break';
  if (s === 'available' || s === 'busy' || s === 'acw' || s === 'break') return s;
  if (s === 'offline') return 'offline';
  return 'offline';
}

/** Normalize routing API agent row → RoutingAgent (live data only). */
export function normalizeRoutingAgent(raw: Record<string, unknown>): RoutingAgent {
  const status = raw.status ?? raw.state;
  const skillsRaw = raw.skills;
  const skills = Array.isArray(skillsRaw)
    ? skillsRaw.map(s => (typeof s === 'string' ? s : (s as { skill?: string })?.skill)).filter(Boolean) as string[]
    : [];

  return {
    id: String(raw.id ?? raw.agentId ?? ''),
    tenantId: String(raw.tenantId ?? 'default'),
    agentId: String(raw.agentId ?? raw.id ?? ''),
    name: String(raw.displayName ?? raw.name ?? raw.agentId ?? 'Agent'),
    displayName: raw.displayName != null ? String(raw.displayName) : null,
    state: mapRoutingStatusToState(status as string),
    skills,
    agentSkills: Array.isArray(raw.agentSkills) ? (raw.agentSkills as RoutingAgent['agentSkills']) : undefined,
    queueKeys: Array.isArray(raw.queueKeys) ? (raw.queueKeys as string[]) : undefined,
    currentCallId: raw.currentCallId != null ? String(raw.currentCallId) : undefined,
    lastStateChange: String(
      raw.liveUpdatedAt ?? raw.updatedAt ?? raw.lastStateChange ?? new Date().toISOString(),
    ),
  };
}

import { AGENT_DESK_EXT, SIP_DOMAIN } from '@/lib/env';

/** Kamailio AOR to dial after ACD assigns — browser desk is always `blinkone`. */
export function resolveAssignDialTarget(status: {
  dialTarget?: string;
  agentId?: string;
} | null): string {
  const raw = status?.dialTarget?.trim();
  if (raw) {
    const user = raw.replace(/^sip:/i, '').split('@')[0]?.toLowerCase() ?? '';
    if (user === 'desk' || user === 'web') return AGENT_DESK_EXT;
    return user || AGENT_DESK_EXT;
  }

  // Fallback: numeric agentId only when routing did not send dialTarget (mobile agent peer).
  const agentId = status?.agentId ? String(status.agentId).trim() : '';
  if (agentId && /^\d+$/.test(agentId)) return agentId;

  return AGENT_DESK_EXT;
}

export function sipDialUri(userOrUri: string): string {
  const raw = userOrUri.trim();
  if (raw.toLowerCase().startsWith('sip:')) return raw;
  const user = raw.split('@')[0];
  return `sip:${user}@${SIP_DOMAIN}`;
}

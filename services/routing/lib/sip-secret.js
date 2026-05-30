import { createHmac } from 'node:crypto';

/** Deterministic per-agent SIP secret derived from master password + agent id. */
export function agentSipPassword(agentId, masterSecret) {
  const base = String(masterSecret || 'blinkone-agent-dev').trim();
  return createHmac('sha256', base).update(`agent:${agentId}`).digest('hex').slice(0, 20);
}

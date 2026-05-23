/**
 * TR-14 — skill-match → longest-idle → least-occupied
 */
import { listAgentStates } from './redis-state.js';

function agentMatchesQueue(agent, queue) {
  if (agent.status !== 'available') return false;
  if (agent.currentCallId) return false;
  const keys = agent.queueKeys ?? [];
  if (keys.length && !keys.includes(queue.queueKey)) return false;
  const required = (queue.skills ?? []).filter((s) => s.required !== false).map((s) => s.skill);
  if (required.length && !required.every((sk) => (agent.skills ?? []).includes(sk))) return false;
  return true;
}

/**
 * @param {string} tenantId
 * @param {object} queue — from queue-repo with skills
 * @returns {object|null} agent state
 */
export async function selectAgent(tenantId, queue) {
  const agents = await listAgentStates(tenantId);
  const pool = agents.filter((a) => agentMatchesQueue(a, queue));
  if (!pool.length) return null;

  const algo = queue.selectionAlgorithm || 'longest_idle';

  if (algo === 'round_robin') {
    pool.sort((a, b) => String(a.agentId).localeCompare(String(b.agentId)));
    return pool[0];
  }

  // longest_idle (default): oldest lastIdleAt first; tie-break lower occupancy
  pool.sort((a, b) => {
    const ta = new Date(a.lastIdleAt || 0).getTime();
    const tb = new Date(b.lastIdleAt || 0).getTime();
    if (ta !== tb) return ta - tb;
    return (a.occupancy ?? 0) - (b.occupancy ?? 0);
  });
  return pool[0];
}

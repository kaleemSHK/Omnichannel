/**
 * TR-14 — skill-match → longest-idle → least-occupied
 *
 * Sprint 1 G01: Added weighted proficiency scoring (1–5) + best_match algorithm.
 * Fully backward-compatible with legacy agent.skills: string[] format.
 */
import { listAgentStates } from './redis-state.js';

// ─── Skill helpers ──────────────────────────────────────────────────────────

/**
 * Resolve the Set of skill names an agent can handle.
 * Supports both formats:
 *   legacy: agent.skills = ['english', 'tier2']
 *   new:    agent.agentSkills = [{skill: 'english', proficiency: 4}]
 */
function resolveAgentSkillNames(agent) {
  if (Array.isArray(agent.agentSkills) && agent.agentSkills.length) {
    return new Set(agent.agentSkills.map((s) => s.skill));
  }
  if (Array.isArray(agent.skills)) {
    return new Set(agent.skills);
  }
  return new Set();
}

/**
 * Return proficiency 1–5 for an agent×skill pair.
 * Falls back to 3 (mid-range) for legacy string-only skill arrays.
 */
function getAgentProficiency(agent, skill) {
  if (Array.isArray(agent.agentSkills)) {
    const entry = agent.agentSkills.find((s) => s.skill === skill);
    if (entry) return entry.proficiency ?? 3;
  }
  if (Array.isArray(agent.skills) && agent.skills.includes(skill)) return 3;
  return 0;
}

/**
 * Returns false if agent cannot handle this queue (binary gate — must pass
 * ALL required skills before considering proficiency scores).
 * Backward-compatible with legacy agent.skills string[].
 */
function agentMatchesQueue(agent, queue) {
  if (agent.status !== 'available') return false;
  if (agent.currentCallId) return false;

  // Queue key affinity filter
  const keys = agent.queueKeys ?? [];
  if (keys.length && !keys.includes(queue.queueKey)) return false;

  // Required skills gate (binary — has skill or not)
  const required = (queue.skills ?? [])
    .filter((s) => s.required !== false)
    .map((s) => s.skill);

  if (!required.length) return true;

  const agentSkillNames = resolveAgentSkillNames(agent);
  return required.every((sk) => agentSkillNames.has(sk));
}

/**
 * Compute weighted skill match score for best_match algorithm.
 * Score = Σ (proficiency_i × queueWeight_i) for every queue skill.
 * Higher score = better match.
 */
function scoreAgentForQueue(agent, queue) {
  const queueSkills = queue.skills ?? [];
  const weights = queue.skillWeights ?? queue.skill_weights ?? {};

  return queueSkills.reduce((sum, qs) => {
    const skillName = qs.skill;
    const queueWeight = weights[skillName] ?? 1.0;
    const proficiency = getAgentProficiency(agent, skillName);
    return sum + proficiency * queueWeight;
  }, 0);
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * @param {string} tenantId
 * @param {object} queue  — from queue-repo, with skills[] and optional skillWeights{}
 * @returns {object|null} selected agent state, or null if none available
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

  if (algo === 'best_match') {
    // Primary sort: highest weighted skill score (descending)
    // Tiebreak: oldest lastIdleAt (longest idle first — ascending)
    pool.sort((a, b) => {
      const scoreDiff = scoreAgentForQueue(b, queue) - scoreAgentForQueue(a, queue);
      if (Math.abs(scoreDiff) > 0.001) return scoreDiff;
      const ta = new Date(a.lastIdleAt || 0).getTime();
      const tb = new Date(b.lastIdleAt || 0).getTime();
      return ta - tb; // older idle time = was idle longer = serve first
    });
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

// Export helpers for tests
export { agentMatchesQueue, scoreAgentForQueue, getAgentProficiency };

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Mirrors selection.js skill-match + longest-idle logic for property-style checks.
 */
function agentMatchesQueue(agent, queue) {
  if (agent.status !== 'available') return false;
  if (agent.currentCallId) return false;
  const keys = agent.queueKeys ?? [];
  if (keys.length && !keys.includes(queue.queueKey)) return false;
  const required = (queue.skills ?? []).filter((s) => s.required !== false).map((s) => s.skill);
  if (required.length && !required.every((sk) => (agent.skills ?? []).includes(sk))) return false;
  return true;
}

function selectAgent(pool, queue) {
  const eligible = pool.filter((a) => agentMatchesQueue(a, queue));
  if (!eligible.length) return null;
  eligible.sort((a, b) => {
    const ta = new Date(a.lastIdleAt || 0).getTime();
    const tb = new Date(b.lastIdleAt || 0).getTime();
    if (ta !== tb) return ta - tb;
    return (a.occupancy ?? 0) - (b.occupancy ?? 0);
  });
  return eligible[0];
}

describe('ACD selection (TR-14)', () => {
  const queue = {
    queueKey: 'sales',
    skills: [{ skill: 'sales', required: true }],
    selectionAlgorithm: 'longest_idle',
  };

  it('picks longest-idle among skill-matched agents', () => {
    const agents = [
      { agentId: 'a1', status: 'available', skills: ['sales'], queueKeys: ['sales'], lastIdleAt: '2026-01-01T10:00:00Z', occupancy: 0 },
      { agentId: 'a2', status: 'available', skills: ['sales'], queueKeys: ['sales'], lastIdleAt: '2026-01-01T09:00:00Z', occupancy: 0 },
      { agentId: 'a3', status: 'available', skills: ['support'], queueKeys: ['sales'], lastIdleAt: '2026-01-01T08:00:00Z', occupancy: 0 },
    ];
    const picked = selectAgent(agents, queue);
    assert.equal(picked.agentId, 'a2');
  });

  it('never picks agent missing required skill', () => {
    const agents = [
      { agentId: 'x', status: 'available', skills: ['billing'], queueKeys: ['sales'], lastIdleAt: '2026-01-01T08:00:00Z' },
    ];
    assert.equal(selectAgent(agents, queue), null);
  });

  it('skips busy agents', () => {
    const agents = [
      { agentId: 'busy', status: 'busy', skills: ['sales'], currentCallId: 'c1', lastIdleAt: '2026-01-01T08:00:00Z' },
      { agentId: 'free', status: 'available', skills: ['sales'], queueKeys: ['sales'], lastIdleAt: '2026-01-01T12:00:00Z' },
    ];
    assert.equal(selectAgent(agents, queue).agentId, 'free');
  });
});

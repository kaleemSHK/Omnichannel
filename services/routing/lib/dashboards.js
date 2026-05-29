import * as queueRepo from './queue-repo.js';
import * as agentRepo from './agent-repo.js';
import { getQueueStats } from './redis-state.js';
import { dbEnabled, getPool } from './db.js';

function mapAgentState(status) {
  if (status === 'away') return 'break';
  if (status === 'available' || status === 'busy' || status === 'offline') return status;
  return 'offline';
}

function longestWaitSec(calls = []) {
  if (!calls.length) return 0;
  const oldest = Math.min(...calls.map((c) => Number(c.score) || Date.now()));
  return Math.max(0, Math.floor((Date.now() - oldest) / 1000));
}

async function dailyCounters(tenantId) {
  if (!dbEnabled()) return { handledToday: 0, missedToday: 0 };
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { rows } = await getPool().query(
      `SELECT
         COUNT(*) FILTER (WHERE outcome = 'handled') AS handled,
         COUNT(*) FILTER (WHERE outcome = 'abandoned') AS missed
       FROM routing_events
       WHERE tenant_id = $1 AND created_at::date = $2::date`,
      [tenantId, today],
    );
    return {
      handledToday: parseInt(rows[0]?.handled ?? '0', 10),
      missedToday: parseInt(rows[0]?.missed ?? '0', 10),
    };
  } catch {
    return { handledToday: 0, missedToday: 0 };
  }
}

export async function getRealtimeDashboard(tenantId) {
  const queues = await queueRepo.listQueues(tenantId);
  const agents = await agentRepo.listAgents(tenantId);
  const queueStats = [];

  for (const q of queues) {
    const live = await getQueueStats(tenantId, q.queueKey);
    const busyOnQueue = agents.filter(
      (a) =>
        a.status === 'busy' &&
        (a.queueKeys ?? []).some((k) => k === q.queueKey),
    ).length;
    queueStats.push({
      id: String(q.id),
      queueId: q.id,
      queueKey: q.queueKey,
      name: q.name,
      waiting: live.waiting,
      active: busyOnQueue,
      longestWait: longestWaitSec(live.calls),
    });
  }

  const { handledToday, missedToday } = await dailyCounters(tenantId);

  return {
    agents: agents.map((a) => ({
      id: String(a.id),
      agentId: a.agentId,
      name: a.displayName || a.agentId,
      email: a.chatwootUserId ? `user-${a.chatwootUserId}@blinksone.com` : '',
      state: mapAgentState(a.status),
      status: a.status,
      currentCallId: a.currentCallId ?? undefined,
      queueId: (a.queueKeys ?? [])[0],
      skills: a.skills ?? [],
      queueKeys: a.queueKeys ?? [],
      updatedAt: a.liveUpdatedAt ?? a.updatedAt ?? new Date().toISOString(),
    })),
    queues: queueStats,
    handledToday,
    missedToday,
    totalToday: handledToday + missedToday,
    updatedAt: new Date().toISOString(),
    tenantId,
    totalWaiting: queueStats.reduce((n, q) => n + q.waiting, 0),
  };
}

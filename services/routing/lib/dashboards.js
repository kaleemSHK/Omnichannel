import * as queueRepo from './queue-repo.js';
import { listAgentStates, getQueueStats } from './redis-state.js';

export async function getRealtimeDashboard(tenantId) {
  const queues = await queueRepo.listQueues(tenantId);
  const agents = await listAgentStates(tenantId);
  const queueStats = [];
  for (const q of queues) {
    const live = await getQueueStats(tenantId, q.queueKey);
    queueStats.push({
      queueId: q.id,
      queueKey: q.queueKey,
      name: q.name,
      waiting: live.waiting,
      calls: live.calls,
    });
  }
  return {
    tenantId,
    at: new Date().toISOString(),
    agents: {
      available: agents.filter((a) => a.status === 'available').length,
      busy: agents.filter((a) => a.status === 'busy').length,
      away: agents.filter((a) => a.status === 'away').length,
      offline: agents.filter((a) => a.status === 'offline').length,
      list: agents,
    },
    queues: queueStats,
    totalWaiting: queueStats.reduce((n, q) => n + q.waiting, 0),
  };
}

import { dequeueCall, setAgentState, getAgentState } from './redis-state.js';
import { getCallMeta, setCallMeta } from './call-meta.js';
import * as queueRepo from './queue-repo.js';

/**
 * Caller left queue (Cancel) or session ended without connect — remove from Redis queue.
 */
export async function abandonCall(tenantId, callId, { reason = 'abandoned' } = {}) {
  const meta = await getCallMeta(tenantId, callId);
  if (!meta) {
    return { callId, status: 'unknown', removed: false };
  }

  if (meta.queueKey && !meta.assignedAt) {
    await dequeueCall(tenantId, meta.queueKey, callId);
  }

  if (meta.agentId && meta.assignedAt) {
    const st = await getAgentState(tenantId, meta.agentId);
    if (st?.currentCallId === callId) {
      await setAgentState(tenantId, meta.agentId, {
        status: 'available',
        currentCallId: null,
        occupancy: Math.max(0, (st.occupancy ?? 1) - 1),
      });
    }
  }

  await setCallMeta(tenantId, callId, {
    ...meta,
    abandonedAt: new Date().toISOString(),
    abandonReason: reason,
  });

  if (meta.queueId) {
    await queueRepo.recordDecision({
      tenantId,
      callId,
      queueId: meta.queueId,
      decision: 'abandoned',
      metadata: { queueKey: meta.queueKey, reason },
    });
  }

  return { callId, status: 'abandoned', queueKey: meta.queueKey ?? null, removed: true };
}

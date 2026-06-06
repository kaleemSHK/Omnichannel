import { forwardUsageToBilling } from '../_shared/lib/billing-forward.js';
import { setAgentState, getAgentState, dequeueCall } from './redis-state.js';
import { getCallMeta } from './call-meta.js';
import * as queueRepo from './queue-repo.js';
import { writeCdr } from './cdr-client.js';

/**
 * End call — free agent, write CDR.
 */
export async function completeCall(tenantId, { callId, disposition, agentId }) {
  const meta = await getCallMeta(tenantId, callId);
  if (meta?.queueKey && callId) {
    await dequeueCall(tenantId, meta.queueKey, callId);
  }
  const aid = agentId || meta?.agentId;
  if (aid) {
    const st = await getAgentState(tenantId, aid);
    if (st) {
      await setAgentState(tenantId, aid, {
        status: 'available',
        currentCallId: null,
        occupancy: Math.max(0, (st.occupancy ?? 1) - 1),
      });
    }
  }

  const endedAt = new Date().toISOString();
  const startedAt = meta?.assignedAt || meta?.enqueuedAt || endedAt;
  const durationMs = Math.max(0, new Date(endedAt).getTime() - new Date(startedAt).getTime());

  await queueRepo.recordDecision({
    tenantId,
    callId,
    queueId: meta?.queueId ?? null,
    decision: 'completed',
    agentId: aid ?? null,
    metadata: { disposition: disposition || 'completed', durationMs },
  });

  const cdr = await writeCdr({
    tenantId,
    callId,
    sessionId: meta?.cdrSessionId ?? meta?.sessionId,
    cdrSessionId: meta?.cdrSessionId,
    queueKey: meta?.queueKey,
    agentId: aid,
    callerId: meta?.callerId,
    callerName: meta?.callerName ?? null,
    callerPhone: meta?.callerPhone ?? meta?.callerId ?? null,
    startedAt,
    endedAt,
    durationMs,
    disposition: disposition || 'completed',
    transport: 'webrtc',
  });

  const minutes = Math.max(0, durationMs / 60000);
  if (minutes > 0) {
    forwardUsageToBilling({
      tenantId,
      dimension: 'minute',
      quantity: minutes,
      sourceService: 'routing',
      sourceEventId: `route-complete-${tenantId}-${callId}`,
    });
  }

  return { status: 'completed', callId, agentId: aid, durationMs, cdr };
}

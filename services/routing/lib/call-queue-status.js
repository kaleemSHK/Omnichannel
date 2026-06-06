import { getCallMeta } from './call-meta.js';
import { connectRedis, queueRedisKey } from './redis-state.js';
import { agentDeskDialTarget } from './dial-target.js';

/**
 * Customer/agent UI: queue position and assignment state for a callId.
 */
export async function getCallRouteStatus(tenantId, callId) {
  const meta = await getCallMeta(tenantId, callId);
  if (!meta) {
    return { callId, status: 'unknown', eventType: 'call:initiate' };
  }

  if (meta.agentId && meta.assignedAt) {
    return {
      callId,
      status: 'assigned',
      eventType: 'call:accepted',
      agentId: meta.agentId,
      dialTarget: meta.dialTarget ?? agentDeskDialTarget(meta.agentId),
      queueKey: meta.queueKey ?? null,
      sessionId: meta.sessionId ?? null,
    };
  }

  const queueKey = meta.queueKey;
  if (queueKey) {
    const r = await connectRedis();
    if (r) {
      const key = queueRedisKey(tenantId, queueKey);
      const rank = await r.zRank(key, callId);
      if (rank != null) {
        const depth = await r.zCard(key);
        return {
          callId,
          status: 'queued',
          eventType: 'call:queued',
          queueKey,
          position: rank + 1,
          depth,
          maxWaitSec: meta.maxWaitSec ?? null,
        };
      }
    }
  }

  return {
    callId,
    status: meta.enqueuedAt ? 'routing' : 'pending',
    eventType: 'queue:update',
    queueKey: meta.queueKey ?? null,
  };
}

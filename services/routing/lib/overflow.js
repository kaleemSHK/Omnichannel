/**
 * TR-15 — overflow when queue depth or wait time exceeds limits.
 */
import * as queueRepo from './queue-repo.js';
import { dequeueCall, enqueueCall, getQueueStats } from './redis-state.js';
import { getCallMeta, setCallMeta } from './call-meta.js';

/**
 * Resolve overflow target queue when primary is at max depth.
 * @returns {object|null} overflow queue, or null to reject
 */
export async function resolveOverflowQueue(tenantId, queue) {
  if (!queue.overflowQueueId) return null;
  return queueRepo.getQueue(tenantId, queue.overflowQueueId);
}

/**
 * Move a waiting call to another queue (overflow).
 */
export async function transferCallToQueue(tenantId, callId, fromQueue, toQueue, reason) {
  await dequeueCall(tenantId, fromQueue.queueKey, callId);
  const meta = (await getCallMeta(tenantId, callId)) ?? {};
  const priority = meta.priority ?? 0;
  const { position, depth } = await enqueueCall(tenantId, toQueue.queueKey, callId, priority);

  await setCallMeta(tenantId, callId, {
    ...meta,
    queueKey: toQueue.queueKey,
    queueId: toQueue.id,
    overflowedFrom: fromQueue.queueKey,
    overflowReason: reason,
    enqueuedAt: new Date().toISOString(),
  });

  await queueRepo.recordDecision({
    tenantId,
    callId,
    queueId: fromQueue.id,
    decision: 'overflow',
    metadata: {
      fromQueueKey: fromQueue.queueKey,
      toQueueKey: toQueue.queueKey,
      reason,
      position,
      depth,
    },
  });

  return { callId, toQueueKey: toQueue.queueKey, position, depth };
}

/**
 * Re-enqueue callers that exceeded maxWaitSec on this queue.
 */
export async function processWaitTimeOverflow(tenantId, queue) {
  if (!queue.maxWaitSec || !queue.overflowQueueId) return [];

  const overflow = await queueRepo.getQueue(tenantId, queue.overflowQueueId);
  if (!overflow) return [];

  const stats = await getQueueStats(tenantId, queue.queueKey);
  const moved = [];
  const limitMs = queue.maxWaitSec * 1000;
  const now = Date.now();

  for (const { callId } of stats.calls) {
    const meta = await getCallMeta(tenantId, callId);
    const enqueuedAt = meta?.enqueuedAt ? new Date(meta.enqueuedAt).getTime() : now;
    if (now - enqueuedAt >= limitMs) {
      await transferCallToQueue(tenantId, callId, queue, overflow, 'max_wait_sec');
      moved.push(callId);
    }
  }
  return moved;
}

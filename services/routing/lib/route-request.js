import * as queueRepo from './queue-repo.js';
import { enqueueCall, getQueueStats } from './redis-state.js';
import { selectAgent } from './selection.js';
import { assignCall } from './route-assign.js';
import { setCallMeta } from './call-meta.js';
import { resolveOverflowQueue, transferCallToQueue } from './overflow.js';

/**
 * Route request: assign immediately if agent available, else enqueue.
 */
export async function handleRouteRequest(tenantId, body) {
  const queueKey = (body.queueKey ?? body.queue ?? 'default').trim();
  const callId = (body.callId ?? body.call_id ?? '').trim();
  if (!callId) {
    const err = new Error('callId required');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const queue = await queueRepo.getQueueByKey(tenantId, queueKey);
  if (!queue) {
    const err = new Error(`Queue "${queueKey}" not found`);
    err.code = 'NOT_FOUND';
    throw err;
  }

  await setCallMeta(tenantId, callId, {
    queueKey,
    queueId: queue.id,
    callerId: body.callerId ?? null,
    enqueuedAt: new Date().toISOString(),
  });

  const statsBefore = await getQueueStats(tenantId, queueKey);
  if (queue.maxDepth != null && statsBefore.waiting >= queue.maxDepth) {
    const overflow = await resolveOverflowQueue(tenantId, queue);
    if (overflow) {
      const moved = await transferCallToQueue(tenantId, callId, queue, overflow, 'max_depth');
      return {
        status: 'overflow',
        callId,
        fromQueueKey: queue.queueKey,
        queueKey: overflow.queueKey,
        queueId: overflow.id,
        position: moved.position,
        depth: moved.depth,
      };
    }
    await queueRepo.recordDecision({
      tenantId,
      callId,
      queueId: queue.id,
      decision: 'rejected_max_depth',
      metadata: { queueKey, depth: statsBefore.waiting },
    });
    const err = new Error('Queue at capacity');
    err.code = 'QUEUE_FULL';
    throw err;
  }

  const agent = await selectAgent(tenantId, queue);
  if (agent) {
    try {
      return await assignCall(tenantId, { callId, queueKey, agentId: agent.agentId });
    } catch (e) {
      if (e.code !== 'AGENT_UNAVAILABLE') throw e;
    }
  }

  const priority = Number(body.priority ?? 0);
  const { position, depth } = await enqueueCall(tenantId, queueKey, callId, priority);

  await queueRepo.recordDecision({
    tenantId,
    callId,
    queueId: queue.id,
    decision: 'enqueued',
    metadata: {
      queueKey,
      position,
      depth,
      callerId: body.callerId ?? null,
      priority,
    },
  });

  return {
    status: 'queued',
    callId,
    queueId: queue.id,
    queueKey,
    position,
    depth,
    maxWaitSec: queue.maxWaitSec,
  };
}

/** Process next waiting call in queue (ACD tick). */
export async function processQueue(tenantId, queueKey) {
  const queue = await queueRepo.getQueueByKey(tenantId, queueKey);
  if (!queue) {
    const err = new Error('Queue not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  return assignCall(tenantId, { queueKey });
}

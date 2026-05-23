import * as queueRepo from './queue-repo.js';
import * as agentRepo from './agent-repo.js';
import { selectAgent } from './selection.js';
import { dequeueCall, setAgentState, peekNextCall } from './redis-state.js';
import { setCallMeta, getCallMeta } from './call-meta.js';
import { notifyBridge } from './ari-notify.js';

/**
 * Reserve agent and dequeue call from queue.
 */
export async function assignCall(tenantId, { callId, queueKey, agentId, queueId }) {
  let queue = queueKey ? await queueRepo.getQueueByKey(tenantId, queueKey) : null;
  if (!queue && queueId) queue = await queueRepo.getQueue(tenantId, queueId);
  if (!queue) {
    const err = new Error('Queue not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const cid = callId || (await peekNextCall(tenantId, queue.queueKey));
  if (!cid) {
    const err = new Error('No call waiting in queue');
    err.code = 'NO_CALL';
    throw err;
  }

  let agent;
  if (agentId) {
    agent = await agentRepo.getAgent(tenantId, agentId);
    if (!agent || agent.status !== 'available') {
      const err = new Error('Agent not available');
      err.code = 'AGENT_UNAVAILABLE';
      throw err;
    }
  } else {
    const picked = await selectAgent(tenantId, queue);
    if (!picked) {
      const err = new Error('No matching agent');
      err.code = 'NO_AGENT';
      throw err;
    }
    agent = picked;
  }

  await setAgentState(tenantId, agent.agentId, {
    status: 'busy',
    currentCallId: cid,
    occupancy: (agent.occupancy ?? 0) + 1,
  });
  await dequeueCall(tenantId, queue.queueKey, cid);

  const sessionId = `cs-${tenantId}-${cid}`;
  await setCallMeta(tenantId, cid, {
    queueKey: queue.queueKey,
    queueId: queue.id,
    agentId: agent.agentId,
    sessionId,
    assignedAt: new Date().toISOString(),
    callerId: (await getCallMeta(tenantId, cid))?.callerId,
  });

  await queueRepo.recordDecision({
    tenantId,
    callId: cid,
    queueId: queue.id,
    decision: 'assigned',
    agentId: agent.agentId,
    metadata: { queueKey: queue.queueKey, sessionId },
  });

  await notifyBridge({ tenantId, callId: cid, agentId: agent.agentId, queueKey: queue.queueKey });

  return {
    status: 'assigned',
    callId: cid,
    agentId: agent.agentId,
    queueKey: queue.queueKey,
    sessionId,
  };
}

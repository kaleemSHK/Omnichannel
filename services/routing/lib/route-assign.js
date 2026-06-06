import * as queueRepo from './queue-repo.js';
import * as agentRepo from './agent-repo.js';
import { selectAgent } from './selection.js';
import { dequeueCall, setAgentState, peekNextCall, claimAgent, releaseAgentClaim } from './redis-state.js';
import { setCallMeta, getCallMeta } from './call-meta.js';
import { notifyBridge } from './ari-notify.js';
import { notifyCallsAgentRing } from './notify-calls-ring.js';
import { agentDeskDialTarget } from './dial-target.js';

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

  // Atomically claim the agent with a Redis NX lock to prevent two concurrent
  // route requests from assigning the same agent (TOCTOU race condition).
  const claimed = await claimAgent(tenantId, agent.agentId, cid);
  if (!claimed) {
    // Another request grabbed this agent between selectAgent() and here.
    const err = new Error('Agent not available');
    err.code = 'AGENT_UNAVAILABLE';
    throw err;
  }

  try {
    await setAgentState(tenantId, agent.agentId, {
      status: 'busy',
      currentCallId: cid,
      occupancy: (agent.occupancy ?? 0) + 1,
    });
  } catch (e) {
    // State update failed — release the lock so the agent isn't stranded.
    await releaseAgentClaim(tenantId, agent.agentId);
    throw e;
  }

  // Lock is intentionally kept until setAgentState persists 'busy' to Redis,
  // after which the agent state itself prevents re-selection.  Release it now.
  await releaseAgentClaim(tenantId, agent.agentId);

  await dequeueCall(tenantId, queue.queueKey, cid);

  const sessionId = `cs-${tenantId}-${cid}`;
  const dialTarget = agentDeskDialTarget(agent.agentId);
  const meta = (await getCallMeta(tenantId, cid)) ?? {};
  await setCallMeta(tenantId, cid, {
    ...meta,
    queueKey: queue.queueKey,
    queueId: queue.id,
    agentId: agent.agentId,
    dialTarget,
    sessionId,
    assignedAt: new Date().toISOString(),
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

  await notifyCallsAgentRing({
    tenantId,
    callId: cid,
    agentId: agent.agentId,
    agentLabel: agent.displayName || agent.agentId,
    queueKey: queue.queueKey,
    callerId: meta.callerPhone ?? meta.callerId,
    callerName: meta?.callerName ?? null,
    callerPhone: meta?.callerPhone ?? null,
    contactId: meta?.contactId ?? null,
    sessionId,
  });

  return {
    status: 'assigned',
    callId: cid,
    agentId: agent.agentId,
    dialTarget: agentDeskDialTarget(agent.agentId),
    queueKey: queue.queueKey,
    sessionId,
  };
}

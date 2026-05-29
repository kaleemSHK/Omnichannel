import * as queueRepo from './queue-repo.js';
import { enqueueCall, getQueueStats } from './redis-state.js';
import { selectAgent } from './selection.js';
import { assignCall } from './route-assign.js';
import { setCallMeta } from './call-meta.js';
import { resolveOverflowQueue, transferCallToQueue } from './overflow.js';

// ─── VIP / AI-Driven Priority Scoring (C53/C54) ───────────────────────────────

/**
 * Query the AI classify endpoint with the caller's ANI to determine VIP status.
 * Returns a priority score: 10 = VIP/enterprise/priority, 0 = normal.
 */
async function getCallerPriority(tenantId, ani) {
  if (!ani) return 0;
  const AI_URL = (process.env.AI_URL || 'http://ai:8793').replace(/\/$/, '');
  const AI_TOKEN = (process.env.AI_TOKEN || '').trim();
  if (!AI_TOKEN) return 0;
  try {
    const res = await fetch(`${AI_URL}/v1/classify/ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AI_TOKEN}` },
      body: JSON.stringify({ subject: ani, description: `Caller ANI: ${ani}` }),
    });
    if (!res.ok) return 0;
    const json = await res.json();
    // If AI classifies as VIP/enterprise/priority, return high score
    const cat = (json.data?.category ?? '').toLowerCase();
    if (cat.includes('vip') || cat.includes('enterprise') || cat.includes('priority')) return 10;
    return 0;
  } catch {
    return 0;
  }
}

// ─── IVR1: per-call skill override ────────────────────────────────────────────

/**
 * Merge IVR-supplied skill requirements into the queue's base skill list.
 * - Skills already in the queue retain their config; `required` is updated if
 *   the override explicitly sets it.
 * - New skills (not on the queue) are added as required=true by default.
 * - Result is used only for this call's selectAgent() — the queue record is
 *   never mutated.
 *
 * @param {Array<{skill:string, required?:boolean}>} baseSkills  queue.skills[]
 * @param {Array<{skill:string, required?:boolean}>} overrides   from IVR node
 * @returns {Array<{skill:string, required:boolean}>}
 */
function mergeSkillOverride(baseSkills, overrides) {
  const map = new Map((baseSkills ?? []).map((s) => [s.skill, { ...s }]));
  for (const ov of overrides) {
    const skill = (ov.skill ?? '').trim().toLowerCase();
    if (!skill) continue;
    if (map.has(skill)) {
      if (ov.required !== undefined) map.get(skill).required = Boolean(ov.required);
    } else {
      map.set(skill, { skill, required: ov.required !== false });
    }
  }
  return [...map.values()];
}

/**
 * Route request: assign immediately if agent available, else enqueue.
 *
 * IVR1 extension: body.skillOverride = [{skill, required?}] lets the IVR
 * transfer node specify per-call skill requirements that are merged with
 * the queue's own skills before agent selection.
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

  // IVR1: build effective skill requirements for this specific call
  const skillOverride = Array.isArray(body.skillOverride) && body.skillOverride.length
    ? body.skillOverride
    : null;
  const effectiveQueue = skillOverride
    ? { ...queue, skills: mergeSkillOverride(queue.skills, skillOverride) }
    : queue;

  await setCallMeta(tenantId, callId, {
    queueKey,
    queueId: queue.id,
    callerId: body.callerId ?? null,
    enqueuedAt: new Date().toISOString(),
    ...(skillOverride ? { skillOverride } : {}),
  });

  // VIP priority scoring — query AI classify with ANI before skill match
  const ani = body.callerId ?? body.ani ?? null;
  const aiPriority = await getCallerPriority(tenantId, ani);
  const vipBoost = aiPriority >= 10;

  const statsBefore = await getQueueStats(tenantId, queueKey);
  if (queue.maxDepth != null && statsBefore.waiting >= queue.maxDepth && !vipBoost) {
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

  const agent = await selectAgent(tenantId, effectiveQueue);
  if (agent) {
    try {
      return await assignCall(tenantId, { callId, queueKey, agentId: agent.agentId });
    } catch (e) {
      if (e.code !== 'AGENT_UNAVAILABLE') throw e;
    }
  }

  const priority = vipBoost ? Math.max(Number(body.priority ?? 0), 10) : Number(body.priority ?? 0);
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
      ...(vipBoost ? { vip: true, aiPriority } : {}),
      ...(skillOverride ? { skillOverride } : {}),
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

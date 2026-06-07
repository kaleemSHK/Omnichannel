import { createLogger } from './logger.js';
import { connectRedis, getQueueStats } from './redis-state.js';
import { tenantRedisKey } from './redis-keys.js';
import { getCallMeta } from './call-meta.js';
import {
  notifyEscalation,
  callEscalationPayload,
} from '../_shared/lib/escalation-notify.js';

const log = createLogger('routing-escalation');

const DEFAULT_LONG_WAIT_MIN = parseInt(process.env.ESCALATION_LONG_WAIT_MINUTES || '10', 10);
const DEDUPE_TTL_SEC = parseInt(process.env.ESCALATION_LONG_WAIT_DEDUPE_SEC || '3600', 10);

function longWaitDedupeKey(tenantId, callId) {
  return tenantRedisKey(tenantId, 'escalation', 'long_wait', callId);
}

async function wasLongWaitNotified(tenantId, callId) {
  const r = await connectRedis();
  if (!r) return false;
  return Boolean(await r.get(longWaitDedupeKey(tenantId, callId)));
}

async function markLongWaitNotified(tenantId, callId) {
  const r = await connectRedis();
  if (!r) return;
  await r.set(longWaitDedupeKey(tenantId, callId), '1', { EX: DEDUPE_TTL_SEC });
}

/** Emit call.abandoned_in_queue when caller leaves queue without connect. */
export async function notifyCallAbandoned(tenantId, meta, { callId, reason = 'abandoned' } = {}) {
  if (!meta?.queueKey && !meta?.queueId) return;
  const enqueuedAt = meta.enqueuedAt ? new Date(meta.enqueuedAt).getTime() : null;
  const waitMinutes = enqueuedAt ? Math.max(0, Math.floor((Date.now() - enqueuedAt) / 60000)) : 0;
  await notifyEscalation(
    tenantId,
    'call.abandoned_in_queue',
    callEscalationPayload(meta, {
      callId,
      queueKey: meta.queueKey,
      reason,
      callStatus: 'missed',
      waitMinutes,
    }),
    log,
  );
}

/** Scan waiting calls and emit call.long_wait once per call (TR-24 P0). */
export async function processLongWaitEscalations(tenantId, queue) {
  const cfg = queue.config && typeof queue.config === 'object' ? queue.config : {};
  const thresholdMin = Number(cfg.longWaitEscalationMinutes ?? DEFAULT_LONG_WAIT_MIN);
  if (!thresholdMin || thresholdMin <= 0) return 0;

  const stats = await getQueueStats(tenantId, queue.queueKey);
  const now = Date.now();
  let emitted = 0;

  for (const { callId } of stats.calls) {
    const meta = await getCallMeta(tenantId, callId);
    if (!meta?.enqueuedAt || meta.assignedAt) continue;

    const waitMinutes = Math.floor((now - new Date(meta.enqueuedAt).getTime()) / 60000);
    if (waitMinutes < thresholdMin) continue;
    if (await wasLongWaitNotified(tenantId, callId)) continue;

    await notifyEscalation(
      tenantId,
      'call.long_wait',
      callEscalationPayload(meta, {
        callId,
        queueKey: queue.queueKey,
        queueName: queue.name,
        waitMinutes,
        callStatus: 'active',
        missedCount: waitMinutes,
      }),
      log,
    );
    await markLongWaitNotified(tenantId, callId);
    emitted += 1;
  }
  return emitted;
}

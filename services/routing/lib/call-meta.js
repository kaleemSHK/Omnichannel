import { connectRedis } from './redis-state.js';
import { tenantRedisKey } from './redis-keys.js';

function callKey(tenantId, callId) {
  return tenantRedisKey(tenantId, 'routing', 'callmeta', callId);
}

export async function setCallMeta(tenantId, callId, meta) {
  const r = await connectRedis();
  if (!r) return;
  const prev = await getCallMeta(tenantId, callId);
  await r.set(callKey(tenantId, callId), JSON.stringify({ ...prev, ...meta, callId, tenantId }), {
    EX: parseInt(process.env.CALL_META_TTL_SEC || '86400', 10),
  });
}

export async function getCallMeta(tenantId, callId) {
  const r = await connectRedis();
  if (!r) return null;
  const raw = await r.get(callKey(tenantId, callId));
  return raw ? JSON.parse(raw) : null;
}

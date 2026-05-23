import { randomUUID } from 'node:crypto';

const REDIS_URL = (process.env.REDIS_URL || '').trim();
const STREAM = process.env.BLINKONE_EVENT_STREAM || 'blinkone:events';

let redis = null;

async function getRedis() {
  if (!REDIS_URL) return null;
  if (redis) return redis;
  const { default: Redis } = await import('ioredis');
  redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 3 });
  return redis;
}

/** Normalize inbound event to BlinkOne envelope and publish. */
export async function publishEvent({ type, tenantId, payload, idempotencyKey }) {
  const envelope = {
    id: randomUUID(),
    type,
    tenant_id: String(tenantId),
    occurred_at: new Date().toISOString(),
    idempotency_key: idempotencyKey,
    payload: payload ?? {},
  };
  const r = await getRedis();
  if (r) {
    await r.xadd(STREAM, '*', 'type', envelope.type, 'body', JSON.stringify(envelope));
  }
  return envelope;
}

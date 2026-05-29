import { createClient } from 'redis';
import { tenantRedisKey } from './redis-keys.js';

/** @type {import('redis').RedisClientType | null} */
let redis = null;

export function redisEnabled() {
  return Boolean((process.env.REDIS_URL || process.env.BLINKONE_REDIS_URL || '').trim());
}

export async function connectRedis(log = console) {
  if (!redisEnabled()) return null;
  if (redis?.isOpen) return redis;
  const url = process.env.REDIS_URL || process.env.BLINKONE_REDIS_URL || 'redis://redis:6379';
  redis = createClient({ url });
  redis.on('error', (err) => log.warn?.({ err: err.message }, 'redis error'));
  await redis.connect();
  return redis;
}

export async function closeRedis() {
  if (redis?.isOpen) await redis.quit();
  redis = null;
}

export function agentRedisKey(tenantId, agentId) {
  return tenantRedisKey(tenantId, 'routing', 'agent', agentId);
}

export function queueRedisKey(tenantId, queueKey) {
  return tenantRedisKey(tenantId, 'routing', 'queue', queueKey);
}

const STATUSES = new Set(['available', 'busy', 'away', 'offline', 'acw']);

/**
 * @param {string} tenantId
 * @param {string} agentId
 * @param {object} patch
 */
export async function setAgentState(tenantId, agentId, patch) {
  const r = await connectRedis();
  if (!r) return null;

  const key = agentRedisKey(tenantId, agentId);
  const prev = await getAgentState(tenantId, agentId);
  const now = new Date().toISOString();

  const next = {
    agentId,
    tenantId,
    status: patch.status ?? prev?.status ?? 'offline',
    currentCallId: patch.currentCallId !== undefined ? patch.currentCallId : (prev?.currentCallId ?? null),
    lastIdleAt:
      patch.lastIdleAt ??
      (patch.status === 'available' ? now : (prev?.lastIdleAt ?? now)),
    // Legacy string[] skills — for backward compat with old selection.js readers
    skills: patch.skills ?? prev?.skills ?? [],
    // New: [{skill, proficiency}] — used by best_match selection algorithm
    agentSkills: patch.agentSkills ?? prev?.agentSkills ?? [],
    queueKeys: patch.queueKeys ?? prev?.queueKeys ?? [],
    occupancy: patch.occupancy ?? prev?.occupancy ?? 0,
    updatedAt: now,
  };

  if (!STATUSES.has(next.status)) {
    const err = new Error(`status must be one of: ${[...STATUSES].join(', ')}`);
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  if (next.status === 'available') {
    next.currentCallId = null;
    next.lastIdleAt = now;
  }
  if (next.status === 'busy' && patch.currentCallId) {
    next.currentCallId = patch.currentCallId;
  }

  await r.set(key, JSON.stringify(next), { EX: parseInt(process.env.AGENT_STATE_TTL_SEC || '86400', 10) });
  return next;
}

export async function getAgentState(tenantId, agentId) {
  const r = await connectRedis();
  if (!r) return null;
  const raw = await r.get(agentRedisKey(tenantId, agentId));
  return raw ? JSON.parse(raw) : null;
}

export async function listAgentStates(tenantId) {
  const r = await connectRedis();
  if (!r) return [];
  const pattern = agentRedisKey(tenantId, '*');
  const keys = await r.keys(pattern);
  if (!keys.length) return [];
  const vals = await r.mGet(keys);
  return vals.filter(Boolean).map((v) => JSON.parse(v));
}

/** FIFO with higher priority first (lower score = dequeued first). */
export function queueScore(priority = 0) {
  return Date.now() - Number(priority) * 60_000_000;
}

export async function enqueueCall(tenantId, queueKey, callId, priority = 0) {
  const r = await connectRedis();
  if (!r) throw new Error('Redis not configured');
  const key = queueRedisKey(tenantId, queueKey);
  const score = queueScore(priority);
  await r.zAdd(key, { score, value: callId });
  const rank = await r.zRank(key, callId);
  const depth = await r.zCard(key);
  return { position: rank != null ? rank + 1 : depth, depth, score };
}

export async function dequeueCall(tenantId, queueKey, callId) {
  const r = await connectRedis();
  if (!r) return;
  await r.zRem(queueRedisKey(tenantId, queueKey), callId);
}

export async function getQueueStats(tenantId, queueKey) {
  const r = await connectRedis();
  if (!r) return { waiting: 0, calls: [] };
  const key = queueRedisKey(tenantId, queueKey);
  const calls = await r.zRangeWithScores(key, 0, -1);
  return {
    waiting: calls.length,
    calls: calls.map((c) => ({ callId: c.value, score: c.score })),
  };
}

export async function peekNextCall(tenantId, queueKey) {
  const r = await connectRedis();
  if (!r) return null;
  const items = await r.zRange(queueRedisKey(tenantId, queueKey), 0, 0);
  return items[0] ?? null;
}

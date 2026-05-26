/**
 * Sliding-window rate limiter — zero external dependencies
 * Sprint 1 G11
 *
 * Uses an in-process Map<key, number[]> of per-window hit timestamps.
 * For multi-replica deployments, swap the `store` with a Redis ZADD/ZCOUNT
 * sliding-window (see comment at bottom of file).
 *
 * Usage:
 *   import { rateLimitMiddleware } from './rate-limiter.js';
 *   app.use('/api/ai', rateLimitMiddleware('ai'));
 */

'use strict';

// ─── Per-route windows ────────────────────────────────────────────────────────

/**
 * Window configs: { max, windowMs }
 * max      — max hits allowed per windowMs per key
 * windowMs — sliding window duration in ms
 */
const ROUTE_LIMITS = {
  auth:       { max: 10,  windowMs: 60_000  }, // brute force guard: 10/min per IP
  ai:         { max: 30,  windowMs: 60_000  }, // LLM calls are expensive
  calls:      { max: 60,  windowMs: 60_000  }, // 1 call/sec per tenant
  recording:  { max: 30,  windowMs: 60_000  }, // recording downloads
  webhooks:   { max: 200, windowMs: 60_000  }, // inbound webhooks (Meta, Chatwoot)
  routing:    { max: 120, windowMs: 60_000  },
  tickets:    { max: 120, windowMs: 60_000  },
  sla:        { max: 120, windowMs: 60_000  },
  billing:    { max: 60,  windowMs: 60_000  },
  platform:   { max: 60,  windowMs: 60_000  },
  default:    { max: 300, windowMs: 60_000  }, // catch-all
};

// ─── In-process store ─────────────────────────────────────────────────────────

/** Map<key, sorted timestamp array> */
const store = new Map();

/** Garbage-collect expired windows every 5 minutes to prevent memory leaks */
const GC_INTERVAL_MS = 5 * 60_000;
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of store.entries()) {
    // Determine the limit config from the key prefix
    const group = key.split(':')[0];
    const { windowMs } = ROUTE_LIMITS[group] ?? ROUTE_LIMITS.default;
    const cutoff = now - windowMs;
    const trimmed = timestamps.filter(t => t > cutoff);
    if (trimmed.length === 0) store.delete(key);
    else store.set(key, trimmed);
  }
}).unref(); // Don't hold process open

// ─── Core counter ─────────────────────────────────────────────────────────────

/**
 * Record a hit and return current window stats.
 * @param {string} group  — route group name (key into ROUTE_LIMITS)
 * @param {string} id     — tenant ID, user ID, or IP
 * @returns {{ count: number, max: number, windowMs: number, remaining: number, resetAt: number }}
 */
function hit(group, id) {
  const { max, windowMs } = ROUTE_LIMITS[group] ?? ROUTE_LIMITS.default;
  const now = Date.now();
  const cutoff = now - windowMs;
  const key = `${group}:${id}`;

  let timestamps = store.get(key) ?? [];
  // Evict expired hits (sliding window)
  timestamps = timestamps.filter(t => t > cutoff);
  timestamps.push(now);
  store.set(key, timestamps);

  const count = timestamps.length;
  const oldest = timestamps[0] ?? now;
  const resetAt = oldest + windowMs;

  return {
    count,
    max,
    windowMs,
    remaining: Math.max(0, max - count),
    resetAt,
  };
}

// ─── Express middleware factory ───────────────────────────────────────────────

/**
 * Returns an Express middleware that rate-limits by tenant ID (from JWT headers)
 * with fallback to IP address.
 *
 * @param {string} group — route group name (key into ROUTE_LIMITS)
 */
function rateLimitMiddleware(group = 'default') {
  return function rateLimitHandler(req, res, next) {
    // Key: prefer tenant ID → fall back to IP
    const tenantId =
      req.headers['x-blinkone-tenant-id'] ||
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      'unknown';

    const stats = hit(group, tenantId);

    // Always set rate-limit headers (RFC 6585 / RateLimit-* draft)
    res.setHeader('X-RateLimit-Limit', stats.max);
    res.setHeader('X-RateLimit-Remaining', stats.remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(stats.resetAt / 1000)); // Unix seconds

    if (stats.count > stats.max) {
      const retryAfterSec = Math.ceil((stats.resetAt - Date.now()) / 1000);
      res.setHeader('Retry-After', retryAfterSec);
      return res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Too many requests. Retry after ${retryAfterSec}s.`,
          retryAfter: retryAfterSec,
        },
      });
    }

    next();
  };
}

/**
 * Special variant for /api/auth/token — keys by IP, not tenant, to prevent
 * credential stuffing even before JWT headers are set.
 */
function authRateLimitMiddleware() {
  return function authRateLimitHandler(req, res, next) {
    const ip =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      'unknown';

    const stats = hit('auth', ip);

    res.setHeader('X-RateLimit-Limit', stats.max);
    res.setHeader('X-RateLimit-Remaining', stats.remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(stats.resetAt / 1000));

    if (stats.count > stats.max) {
      const retryAfterSec = Math.ceil((stats.resetAt - Date.now()) / 1000);
      res.setHeader('Retry-After', retryAfterSec);
      return res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Too many auth attempts. Retry after ${retryAfterSec}s.`,
          retryAfter: retryAfterSec,
        },
      });
    }

    next();
  };
}

export { rateLimitMiddleware, authRateLimitMiddleware, ROUTE_LIMITS, hit };

/*
 * ─── Redis upgrade path (multi-replica) ──────────────────────────────────────
 *
 * Replace the in-process `store` with a Redis ZADD sliding window:
 *
 *   const redis = new Redis(process.env.REDIS_URL);
 *
 *   async function hit(group, id) {
 *     const { max, windowMs } = ROUTE_LIMITS[group] ?? ROUTE_LIMITS.default;
 *     const now = Date.now();
 *     const key = `rl:${group}:${id}`;
 *     const multi = redis.multi();
 *     multi.zremrangebyscore(key, '-inf', now - windowMs);
 *     multi.zadd(key, now, `${now}-${Math.random()}`);
 *     multi.zcard(key);
 *     multi.zrange(key, 0, 0, 'WITHSCORES');
 *     multi.pexpire(key, windowMs);
 *     const [,, [count], [, oldest]] = await multi.exec();
 *     return { count, max, windowMs, remaining: Math.max(0, max - count),
 *              resetAt: Number(oldest) + windowMs };
 *   }
 *
 * The middleware factory above works unchanged — only `hit()` changes.
 */

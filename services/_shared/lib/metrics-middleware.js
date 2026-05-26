/**
 * Prometheus metrics Express middleware — Sprint 2 MON1
 *
 * Usage in any service server.js:
 *
 *   import { mountMetrics } from '../_shared/lib/metrics-middleware.js';
 *   // After creating `app` and before route definitions:
 *   mountMetrics(app, 'calls');
 *
 * This adds:
 *   - Request counter:   blinkone_http_requests_total{service,method,path,status}
 *   - Latency histogram: blinkone_http_request_duration_ms{service,method,path}
 *   - GET /metrics       (Prometheus scrape endpoint)
 */

'use strict';

import { registry, collectProcessMetrics } from './metrics.js';

// ─── Shared HTTP metrics (registered once, shared across all services in proc) ─

const httpRequestsTotal = registry.counter(
  'blinkone_http_requests_total',
  'Total HTTP requests handled',
);

const httpDurationMs = registry.histogram(
  'blinkone_http_request_duration_ms',
  'HTTP request duration in milliseconds',
  [10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
);

// ─── Path normalisation ────────────────────────────────────────────────────

/** Collapse UUIDs, numeric IDs, and hex strings in URL paths for cardinality control */
function normalisePath(path) {
  return (path ?? '/')
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:uuid')
    .replace(/\/\d{4,}/g, '/:id')
    .replace(/\?.*$/, '');
}

// ─── Middleware ────────────────────────────────────────────────────────────

/**
 * Express middleware that records request count and latency.
 * @param {string} service — service name label value
 */
function metricsMiddleware(service) {
  return (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const path   = normalisePath(req.path ?? req.url);
      const method = req.method ?? 'UNKNOWN';
      const status = String(res.statusCode ?? 0);
      const ms     = Date.now() - start;

      httpRequestsTotal.inc({ service, method, path, status });
      httpDurationMs.observe({ service, method, path }, ms);
    });
    next();
  };
}

// ─── /metrics endpoint handler ─────────────────────────────────────────────

function metricsHandler(_req, res) {
  const body = registry.serialize();
  res.set('Content-Type', registry.contentType());
  res.end(body);
}

// ─── Convenience mount helper ──────────────────────────────────────────────

/**
 * Add Prometheus instrumentation to an Express app.
 *
 * Registers:
 *   - HTTP request/duration middleware
 *   - GET /metrics scrape endpoint
 *   - Process-level metrics (uptime, RSS, heap)
 *
 * @param {import('express').Application} app
 * @param {string} service — used as the `service` label in all metrics
 */
export function mountMetrics(app, service) {
  collectProcessMetrics(service);
  app.use(metricsMiddleware(service));
  // Metrics endpoint should NOT require auth — Prometheus scrapes it directly.
  // Protect at network level (not exposed through gateway).
  app.get('/metrics', metricsHandler);
}

export { registry, metricsHandler, metricsMiddleware };

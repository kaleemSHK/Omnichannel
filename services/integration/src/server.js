import { createHmac, timingSafeEqual } from 'node:crypto';
import express from 'express';
import { createLogger } from '../lib/logger.js';
import { createStore } from '../lib/store.js';
import { ok, fail, bearerAuth, requestId, errorHandler, healthRouter, gracefulShutdown } from '../lib/http.js';
import { dbEnabled, runMigrations, closePool, getPool } from '../lib/db.js';
import * as repo from '../lib/integration-repo.js';
import { verifySignature } from '../lib/webhook-sign.js';
import { writeAudit, listAudit } from '../lib/audit.js';
import { startIntegrationWorkers } from '../lib/workers.js';
import { provisionRealm } from '../lib/keycloak.js';
import { loadAggregatedOpenApi, docsHtml } from '../lib/docs-portal.js';
import { listConnectorTypes } from '../lib/connectors/framework.js';
import { mountMetrics } from '../_shared/lib/metrics-middleware.js';
import { requireFeature } from '../_shared/lib/features.js';
import { forwardChatwootToSla } from '../lib/sla-forward.js';

const log = createLogger('integration');
const PORT = parseInt(process.env.PORT || '8800', 10);
const TOKEN = (process.env.TOKEN || '').trim();
const CHATWOOT_SECRET = (process.env.CHATWOOT_WEBHOOK_SECRET || '').trim();
const auth = bearerAuth(TOKEN);
const ssoFeature = requireFeature('sso', tenantId, fail);
const auditFeature = requireFeature('audit', tenantId, fail);
const legacyStore = createStore(process.env.DATA_DIR || './data', { webhooks: [], deliveries: [], connectors: [] });

const app = express();
app.disable('x-powered-by');
app.use(requestId);
healthRouter(app, 'integration');
mountMetrics(app, 'integration');

function tenantId(req) {
  return String(
    req.headers['x-blinkone-tenant-id'] || req.query.tenant_id || req.body?.tenantId || req.body?.tenant_id || 'default',
  );
}

function actorId(req) {
  return req.headers['x-blinkone-actor-id'] || req.headers['x-blinkone-user-id'] || 'api';
}

// ─── Inbound webhooks (no bearer — signature verified) ───────────────────────
app.post('/webhooks/chatwoot', express.json({ limit: '1mb' }), async (req, res) => {
  if (CHATWOOT_SECRET) {
    const sig = (req.headers['x-chatwoot-signature'] || '').trim();
    const expected = `sha256=${createHmac('sha256', CHATWOOT_SECRET).update(JSON.stringify(req.body)).digest('hex')}`;
    try {
      if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
        return fail(res, 'INVALID_SIGNATURE', 'Chatwoot signature mismatch', 401);
      }
    } catch {
      return fail(res, 'INVALID_SIGNATURE', 'Invalid signature', 401);
    }
  }
  res.status(200).json({ ok: true });
  if (!dbEnabled()) return;
  try {
    const norm = await repo.normalizeChatwootWebhook(req.body);
    await repo.dispatchBusEvent(norm);
    await forwardChatwootToSla(norm.tenantId, norm.type, req.body);
  } catch (e) {
    log.warn({ err: e.message }, 'chatwoot webhook');
  }
});

app.post('/webhooks/psp/:provider', express.json({ limit: '256kb' }), async (req, res) => {
  const sig = req.headers['x-psp-signature'] || req.headers['x-thawani-signature'];
  if (process.env.PSP_WEBHOOK_SECRET && sig !== process.env.PSP_WEBHOOK_SECRET) {
    return fail(res, 'UNAUTHORIZED', 'Invalid PSP signature', 401);
  }
  const tid = req.body?.tenant_id || req.body?.tenantId || 'default';
  if (dbEnabled()) {
    await repo.dispatchBusEvent({
      event: `psp.${req.params.provider}.callback`,
      tenantId: tid,
      payload: req.body,
      idempotencyKey: req.body?.id,
    });
  }
  return ok(res, { received: true });
});

app.use(express.json({ limit: '512kb' }));

app.get('/readyz', async (_req, res) => {
  if (!dbEnabled()) return res.json({ status: 'ready', db: false, mode: 'legacy' });
  try {
    await getPool().query('SELECT 1');
    return res.json({ status: 'ready', db: true });
  } catch (e) {
    return res.status(503).json({ status: 'not_ready', error: e.message });
  }
});

// ─── API docs portal (TR-46, TR-50) ───────────────────────────────────────────
app.get('/blinkone/api/docs', (_req, res) => {
  res.type('html').send(docsHtml());
});
app.get('/v1/docs/openapi.json', (_req, res) => res.json(loadAggregatedOpenApi()));

// ─── Outbound webhook endpoints ───────────────────────────────────────────────
app.get('/v1/webhooks', auth, async (req, res) => {
  if (!dbEnabled()) {
    let hooks = legacyStore.load().webhooks;
    if (req.query.tenant_id) hooks = hooks.filter((h) => String(h.tenantId) === String(req.query.tenant_id));
    return ok(res, hooks);
  }
  return ok(res, await repo.listEndpoints(tenantId(req)));
});

app.post('/v1/webhooks', auth, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  const { url } = req.body ?? {};
  if (!url?.trim()) return fail(res, 'VALIDATION_ERROR', 'url required');
  const result = await repo.createEndpoint(tenantId(req), req.body, actorId(req));
  return ok(res, result, 201);
});

app.delete('/v1/webhooks/:id', auth, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  const deleted = await repo.deleteEndpoint(tenantId(req), req.params.id, actorId(req));
  if (!deleted) return fail(res, 'NOT_FOUND', 'Not found', 404);
  return res.status(204).end();
});

app.post('/v1/webhooks/:id/test', auth, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  const tid = tenantId(req);
  const envelope = await repo.dispatchBusEvent({
    event: 'integration.test',
    tenantId: tid,
    payload: { sample: true, at: new Date().toISOString() },
    idempotencyKey: `test-${req.params.id}-${Date.now()}`,
  });
  return ok(res, { sent: true, eventId: envelope.id });
});

app.get('/v1/webhooks/deliveries', auth, async (req, res) => {
  if (!dbEnabled()) return ok(res, (legacyStore.load().deliveries ?? []).slice().reverse());
  return ok(res, await repo.listDeliveries(tenantId(req)));
});

app.post('/v1/webhooks/deliveries/:id/retry', auth, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  const result = await repo.retryDelivery(tenantId(req), req.params.id);
  return ok(res, result ?? { status: 'not_found' });
});

// Gateway fan-out (legacy path)
app.post('/v1/webhooks/dispatch', async (req, res) => {
  res.status(200).json({ ok: true });
  const { event, tenantId: tid = 0, payload } = req.body ?? {};
  if (dbEnabled()) {
    await repo.dispatchBusEvent({
      event: event || 'unknown',
      tenantId: String(tid),
      payload,
      idempotencyKey: req.body?.idempotencyKey,
    }).catch((e) => log.warn({ err: e.message }, 'dispatch'));
  } else {
    const hooks = (legacyStore.load().webhooks ?? []).filter((h) => h.active);
    for (const h of hooks) {
      fetch(h.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, tenantId: tid, payload }),
      }).catch(() => {});
    }
  }
});

// Signature verification docs endpoint
app.get('/v1/webhooks/signature-docs', (_req, res) => {
  ok(res, {
    header: 'X-BlinkOne-Signature',
    format: 't=<unix_timestamp>,v1=<hmac_sha256_hex>',
    algorithm: 'HMAC-SHA256(secret, `${t}.${rawBody}`)',
    example: 't=1710000000,v1=abc123...',
  });
});

// ─── SSO (TR-49) ─────────────────────────────────────────────────────────────
app.get('/v1/sso/config', auth, ssoFeature, async (req, res) => {
  if (!dbEnabled()) return ok(res, { configured: false });
  const cfg = await repo.getSsoConfig(tenantId(req));
  return ok(res, cfg ?? { configured: false });
});

app.put('/v1/sso/config', auth, ssoFeature, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  const cfg = await repo.upsertSsoConfig(tenantId(req), req.body, actorId(req));
  if (req.body?.provision !== false) {
    await provisionRealm({
      slug: cfg.slug,
      providerType: cfg.providerType,
      clientId: cfg.clientId,
      discoveryUrl: cfg.discoveryUrl,
    }).catch((e) => log.warn({ err: e.message }, 'keycloak provision'));
  }
  return ok(res, cfg);
});

app.get('/v1/sso/login', async (req, res) => {
  const slug = req.query.tenant || req.query.slug || 'default';
  return ok(res, { loginUrl: repo.buildSsoLoginUrl(slug) });
});

app.post('/v1/sso/jit-provision', auth, ssoFeature, async (req, res) => {
  const { email, name, groups = [], chatwootAccountId } = req.body ?? {};
  if (!email) return fail(res, 'VALIDATION_ERROR', 'email required');
  const role = groups.includes('admin') ? 'administrator' : groups.includes('supervisor') ? 'supervisor' : 'agent';
  await writeAudit({
    tenantId: tenantId(req),
    actorId: email,
    action: 'sso.jit_provision',
    targetType: 'user',
    targetId: email,
    after: { role, chatwootAccountId },
  });
  return ok(res, { email, role, status: 'provisioned_stub', note: 'Wire Chatwoot Platform API in production' });
});

// Legacy
app.post('/v1/sso', auth, ssoFeature, async (req, res) => {
  if (!dbEnabled()) return ok(res, { status: 'legacy_stub' }, 201);
  return ok(res, await repo.upsertSsoConfig(tenantId(req), req.body, actorId(req)), 201);
});

// ─── Connectors (TR-48) ───────────────────────────────────────────────────────
app.get('/v1/connectors/types', auth, (_req, res) => ok(res, listConnectorTypes()));

app.get('/v1/connectors', auth, async (req, res) => {
  if (!dbEnabled()) return ok(res, legacyStore.load().connectors ?? []);
  return ok(res, await repo.listConnectors(tenantId(req)));
});

app.put('/v1/connectors/:type', auth, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  try {
    const c = await repo.upsertConnector(tenantId(req), { ...req.body, connectorType: req.params.type }, actorId(req));
    return ok(res, c);
  } catch (e) {
    if (e.code === 'VALIDATION_ERROR') return fail(res, 'VALIDATION_ERROR', e.message, 400);
    throw e;
  }
});

app.post('/v1/connectors/:type/test', auth, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  return ok(res, await repo.testConnector(tenantId(req), req.params.type));
});

app.post('/v1/connectors', auth, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  return ok(res, await repo.upsertConnector(tenantId(req), req.body, actorId(req)), 201);
});

// ─── Audit (TR-57) ────────────────────────────────────────────────────────────
app.get('/v1/audit', auth, auditFeature, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  const tid = tenantId(req);
  const result = await listAudit(tid, {
    actorId: req.query.actor_id,
    action: req.query.action,
    targetType: req.query.target_type,
    targetId: req.query.target_id,
    from: req.query.from,
    to: req.query.to,
    limit: parseInt(req.query.limit || '50', 10),
    offset: parseInt(req.query.offset || '0', 10),
  });
  return ok(res, { events: result.rows, total: result.total });
});

app.get('/v1/audit/export.csv', auth, auditFeature, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  const { rows } = await listAudit(tenantId(req), { limit: 5000, offset: 0 });
  const header = 'id,tenant_id,actor_id,action,target_type,target_id,occurred_at\n';
  const lines = rows.map((r) =>
    [r.id, r.tenant_id, r.actor_id, r.action, r.target_type, r.target_id, r.occurred_at].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','),
  );
  res.setHeader('Content-Type', 'text/csv');
  res.send(header + lines.join('\n'));
});

app.post('/v1/audit', auth, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  const { action, targetType, targetId, before, after, metadata } = req.body ?? {};
  const id = await writeAudit({
    tenantId: tenantId(req),
    actorId: actorId(req),
    action,
    targetType,
    targetId,
    before,
    after,
    metadata,
  });
  return ok(res, { id }, 201);
});

// ─── Tenant API keys ──────────────────────────────────────────────────────────
app.post('/v1/api-keys', auth, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  const { name } = req.body ?? {};
  if (!name) return fail(res, 'VALIDATION_ERROR', 'name required');
  return ok(res, await repo.createApiKey(tenantId(req), name, actorId(req)), 201);
});

app.use(errorHandler(log));

async function boot() {
  if (dbEnabled()) {
    await runMigrations(log);
    startIntegrationWorkers(log);
    log.info('integration Postgres mode');
  } else {
    log.warn('BLINKONE_DATABASE_URL unset — legacy file store');
  }
  const server = app.listen(PORT, '0.0.0.0', () => log.info({ port: PORT }, 'integration started'));
  process.on('SIGTERM', () => closePool());
  gracefulShutdown(server, log);
}

boot().catch((e) => {
  log.error(e);
  process.exit(1);
});

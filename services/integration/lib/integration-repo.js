import { randomUUID, createHash } from 'node:crypto';
import { getPool, tenantQuery } from './db.js';
import { hashSecret, generateSecret, signPayload, nextRetryAt } from './webhook-sign.js';
import { publishEvent } from './bus.js';
import { writeAudit } from './audit.js';
import { getConnector } from './connectors/framework.js';

function mapEndpoint(r) {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    name: r.name,
    url: r.url,
    eventsSubscribed: r.events_subscribed,
    enabled: r.enabled,
    extraHeaders: r.extra_headers ?? {},
    retryPolicy: r.retry_policy,
    createdAt: r.created_at,
  };
}

function mapDelivery(r) {
  return {
    id: r.id,
    endpointId: r.endpoint_id,
    tenantId: r.tenant_id,
    eventId: r.event_id,
    eventType: r.event_type,
    attempt: r.attempt,
    status: r.status,
    responseStatus: r.response_status,
    responseBodyTruncated: r.response_body_truncated,
    attemptedAt: r.attempted_at,
    nextRetryAt: r.next_retry_at,
    createdAt: r.created_at,
  };
}

export async function listEndpoints(tenantId) {
  const { rows } = await tenantQuery(
    getPool(),
    tenantId,
    'SELECT * FROM integration_webhook_endpoints ORDER BY created_at DESC',
    [],
  );
  return rows.map(mapEndpoint);
}

export async function createEndpoint(tenantId, body, actorId) {
  const secret = body.secret || generateSecret();
  const secretEnc = Buffer.from(secret, 'utf8').toString('base64');
  const { rows } = await getPool().query(
    `INSERT INTO integration_webhook_endpoints (tenant_id, name, url, secret_hash, secret_enc, events_subscribed, enabled, extra_headers)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [
      tenantId,
      body.name || 'Webhook',
      body.url.trim(),
      hashSecret(secret),
      secretEnc,
      body.eventsSubscribed ?? body.events ?? ['*'],
      body.enabled !== false,
      JSON.stringify(body.extraHeaders ?? {}),
    ],
  );
  await writeAudit({
    tenantId,
    actorId,
    action: 'webhook_endpoint.create',
    targetType: 'webhook_endpoint',
    targetId: rows[0].id,
    after: mapEndpoint(rows[0]),
  });
  return { endpoint: mapEndpoint(rows[0]), secret };
}

export async function deleteEndpoint(tenantId, id, actorId) {
  const { rowCount } = await tenantQuery(
    getPool(),
    tenantId,
    'DELETE FROM integration_webhook_endpoints WHERE id = $1',
    [id],
  );
  if (!rowCount) return false;
  await writeAudit({ tenantId, actorId, action: 'webhook_endpoint.delete', targetType: 'webhook_endpoint', targetId: id });
  return true;
}

function eventMatches(subscribed, eventType) {
  if (!subscribed?.length) return false;
  if (subscribed.includes('*')) return true;
  return subscribed.some((s) => eventType === s || eventType.startsWith(`${s}.`));
}

export async function enqueueOutboundDeliveries({ tenantId, eventType, eventId, payload }) {
  const p = getPool();
  if (!p) return [];
  const { rows: endpoints } = await p.query(
    `SELECT * FROM integration_webhook_endpoints WHERE tenant_id = $1 AND enabled = true`,
    [tenantId],
  );
  const queued = [];
  for (const ep of endpoints) {
    if (!eventMatches(ep.events_subscribed, eventType)) continue;
    const body = { id: eventId, type: eventType, tenant_id: tenantId, occurred_at: new Date().toISOString(), payload };
    const { rows } = await p.query(
      `INSERT INTO integration_webhook_deliveries (endpoint_id, tenant_id, event_id, event_type, status, request_body, next_retry_at)
       VALUES ($1,$2,$3,$4,'pending',$5,now()) RETURNING id`,
      [ep.id, tenantId, eventId, eventType, JSON.stringify(body)],
    );
    queued.push(rows[0].id);
  }
  return queued;
}

export async function deliverOne(deliveryId, secretPlain) {
  const p = getPool();
  const { rows } = await p.query(
    `SELECT d.*, e.url, e.secret_enc, e.extra_headers FROM integration_webhook_deliveries d
     JOIN integration_webhook_endpoints e ON e.id = d.endpoint_id WHERE d.id = $1`,
    [deliveryId],
  );
  if (!rows.length) return null;
  const d = rows[0];
  const body = d.request_body;
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  const secret = secretPlain || (d.secret_enc ? Buffer.from(d.secret_enc, 'base64').toString('utf8') : process.env.WEBHOOK_DEV_SECRET || 'dev');
  const { header } = signPayload(secret, raw);
  const headers = {
    'Content-Type': 'application/json',
    'X-BlinkOne-Event': d.event_type,
    'X-BlinkOne-Signature': header,
    ...(d.extra_headers || {}),
  };
  let status = 'failed';
  let responseStatus = null;
  let responseBody = null;
  try {
    const res = await fetch(d.url, { method: 'POST', headers, body: raw });
    responseStatus = res.status;
    responseBody = (await res.text()).slice(0, 2000);
    status = res.ok ? 'succeeded' : 'failed';
  } catch (e) {
    responseBody = e.message;
  }
  const attempt = d.attempt + 1;
  if (status === 'succeeded') {
    await p.query(
      `UPDATE integration_webhook_deliveries SET status = 'succeeded', attempt = $2, response_status = $3,
       response_body_truncated = $4, attempted_at = now(), next_retry_at = NULL WHERE id = $1`,
      [deliveryId, attempt, responseStatus, responseBody],
    );
  } else if (attempt >= 6) {
    await p.query(
      `UPDATE integration_webhook_deliveries SET status = 'dead', attempt = $2, response_status = $3,
       response_body_truncated = $4, attempted_at = now(), next_retry_at = NULL WHERE id = $1`,
      [deliveryId, attempt, responseStatus, responseBody],
    );
  } else {
    await p.query(
      `UPDATE integration_webhook_deliveries SET status = 'failed', attempt = $2, response_status = $3,
       response_body_truncated = $4, attempted_at = now(), next_retry_at = $5 WHERE id = $1`,
      [deliveryId, attempt, responseStatus, responseBody, nextRetryAt(attempt)],
    );
  }
  return { status, attempt, responseStatus };
}

export async function processDueDeliveries(log = console) {
  const p = getPool();
  if (!p) return 0;
  const { rows } = await p.query(
    `SELECT id FROM integration_webhook_deliveries
     WHERE status IN ('pending', 'failed') AND (next_retry_at IS NULL OR next_retry_at <= now())
     ORDER BY created_at LIMIT 50`,
  );
  for (const { id } of rows) {
    await deliverOne(id).catch((e) => log.warn?.({ id, err: e.message }, 'delivery failed'));
  }
  return rows.length;
}

export async function dispatchBusEvent({ event, tenantId, payload, idempotencyKey }) {
  const envelope = await publishEvent({
    type: event,
    tenantId: String(tenantId),
    payload,
    idempotencyKey,
  });
  await enqueueOutboundDeliveries({
    tenantId: String(tenantId),
    eventType: event,
    eventId: envelope.id,
    payload,
  });
  const connectors = await listConnectors(tenantId);
  for (const c of connectors.filter((x) => x.status === 'connected' || x.status === 'configured')) {
    const impl = getConnector(c.connectorType);
    if (!impl?.push) continue;
    impl.push({ tenantId, config: c.config, secrets: c.secrets }, envelope).catch(() => {});
  }
  return envelope;
}

export async function normalizeChatwootWebhook(body) {
  const event = body.event || 'chatwoot.unknown';
  const accountId = body.account?.id ?? body.account_id ?? 'default';
  const tenantId = String(accountId);
  const typeMap = {
    conversation_created: 'conversation.created',
    message_created: 'message.created',
    conversation_status_changed: 'conversation.status_changed',
    conversation_updated: 'conversation.updated',
    conversation_resolved: 'conversation.resolved',
    conversation_reopened: 'conversation.reopened',
  };
  const type = typeMap[event] || `chatwoot.${event}`;
  return {
    type,
    tenantId,
    payload: body,
    idempotencyKey: `cw-${event}-${body.id ?? body.conversation?.id ?? randomUUID()}`,
  };
}

// SSO
export async function getSsoConfig(tenantId) {
  const { rows } = await getPool().query('SELECT * FROM integration_sso_configs WHERE tenant_id = $1', [tenantId]);
  if (!rows.length) return null;
  const r = rows[0];
  return {
    id: r.id,
    tenantId: r.tenant_id,
    slug: r.slug,
    realmName: r.realm_name,
    providerType: r.provider_type,
    clientId: r.client_id,
    discoveryUrl: r.discovery_url,
    metadata: r.metadata,
    enabled: r.enabled,
  };
}

export async function upsertSsoConfig(tenantId, body, actorId) {
  const realm = body.realmName || `blinkone-${body.slug || tenantId}`;
  const { rows } = await getPool().query(
    `INSERT INTO integration_sso_configs (tenant_id, slug, realm_name, provider_type, client_id, discovery_url, metadata, enabled)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (tenant_id) DO UPDATE SET
       slug = EXCLUDED.slug, realm_name = EXCLUDED.realm_name, provider_type = EXCLUDED.provider_type,
       client_id = EXCLUDED.client_id, discovery_url = EXCLUDED.discovery_url, metadata = EXCLUDED.metadata,
       enabled = EXCLUDED.enabled, updated_at = now()
     RETURNING *`,
    [
      tenantId,
      body.slug || tenantId,
      realm,
      body.providerType || 'oidc',
      body.clientId,
      body.discoveryUrl,
      JSON.stringify(body.metadata ?? {}),
      !!body.enabled,
    ],
  );
  await writeAudit({ tenantId, actorId, action: 'sso.upsert', targetType: 'sso_config', targetId: rows[0].id, after: rows[0] });
  return getSsoConfig(tenantId);
}

export function buildSsoLoginUrl(slug, state) {
  const base = (process.env.KEYCLOAK_URL || 'http://blinkone-keycloak:8080').replace(/\/$/, '');
  const gateway = (process.env.FRONTEND_URL || 'http://localhost').replace(/\/$/, '');
  const realm = `blinkone-${slug}`;
  const redirect = encodeURIComponent(`${gateway}/blinkone/auth/callback`);
  const stateParam = state ? `&state=${encodeURIComponent(state)}` : '';
  return `${base}/realms/${realm}/protocol/openid-connect/auth?client_id=blinkone-dashboard&redirect_uri=${redirect}&response_type=code&scope=openid%20email%20profile${stateParam}`;
}

// Connectors
export async function listConnectors(tenantId) {
  const { rows } = await tenantQuery(getPool(), tenantId, 'SELECT * FROM integration_connectors ORDER BY connector_type', []);
  return rows.map((r) => ({
    id: r.id,
    tenantId: r.tenant_id,
    connectorType: r.connector_type,
    name: r.name,
    config: r.config,
    status: r.status,
    lastHealthAt: r.last_health_at,
    lastError: r.last_error,
  }));
}

export async function upsertConnector(tenantId, body, actorId) {
  const impl = getConnector(body.connectorType);
  if (!impl) {
    const err = new Error(`Unknown connector: ${body.connectorType}`);
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  const { rows } = await getPool().query(
    `INSERT INTO integration_connectors (tenant_id, connector_type, name, config, secrets_enc, status)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (tenant_id, connector_type) DO UPDATE SET
       name = EXCLUDED.name, config = EXCLUDED.config, secrets_enc = COALESCE(EXCLUDED.secrets_enc, integration_connectors.secrets_enc),
       status = EXCLUDED.status, updated_at = now()
     RETURNING *`,
    [
      tenantId,
      body.connectorType,
      body.name || body.connectorType,
      JSON.stringify(body.config ?? {}),
      body.secrets ? JSON.stringify(body.secrets) : null,
      body.status || 'configured',
    ],
  );
  await writeAudit({ tenantId, actorId, action: 'connector.upsert', targetType: 'connector', targetId: rows[0].id });
  return listConnectors(tenantId).then((all) => all.find((c) => c.id === rows[0].id));
}

export async function testConnector(tenantId, connectorType) {
  const { rows } = await getPool().query(
    'SELECT * FROM integration_connectors WHERE tenant_id = $1 AND connector_type = $2',
    [tenantId, connectorType],
  );
  if (!rows.length) return { ok: false, detail: 'not found' };
  const impl = getConnector(connectorType);
  const secrets = rows[0].secrets_enc ? JSON.parse(rows[0].secrets_enc) : {};
  return impl.healthcheck({ tenantId, config: rows[0].config, secrets });
}

export async function listDeliveries(tenantId, limit = 100) {
  const { rows } = await tenantQuery(
    getPool(),
    tenantId,
    `SELECT * FROM integration_webhook_deliveries ORDER BY created_at DESC LIMIT $1`,
    [limit],
  );
  return rows.map(mapDelivery);
}

export async function retryDelivery(tenantId, deliveryId) {
  await tenantQuery(
    getPool(),
    tenantId,
    `UPDATE integration_webhook_deliveries SET status = 'pending', next_retry_at = now() WHERE id = $1`,
    [deliveryId],
  );
  return deliverOne(deliveryId);
}

export async function createApiKey(tenantId, name, actorId) {
  const raw = `bnk_${randomUUID().replace(/-/g, '')}`;
  const prefix = raw.slice(0, 12);
  const hash = createHash('sha256').update(raw).digest('hex');
  const { rows } = await getPool().query(
    `INSERT INTO integration_api_keys (tenant_id, name, key_prefix, key_hash) VALUES ($1,$2,$3,$4) RETURNING id, name, key_prefix, created_at`,
    [tenantId, name, prefix, hash],
  );
  await writeAudit({ tenantId, actorId, action: 'api_key.create', targetType: 'api_key', targetId: rows[0].id });
  return { ...rows[0], key: raw };
}

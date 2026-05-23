import { randomUUID } from 'node:crypto';
import { getPool } from './db.js';
const BILLING_URL = (process.env.BILLING_URL || 'http://billing:8794').replace(/\/$/, '');
const BILLING_TOKEN = (process.env.BILLING_TOKEN || '').trim();

function forwardUsageToBilling(payload) {
  if (!payload.tenantId || !payload.dimension) return;
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (BILLING_TOKEN) headers.Authorization = `Bearer ${BILLING_TOKEN}`;
  fetch(`${BILLING_URL}/v1/usage/events`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  }).catch(() => {});
}

const BILLING_DIMENSION = {
  ai_token: 'ai_token',
  stt_minute: 'stt_minute',
  tts_char: 'tts_char',
};

export async function recordUsage(tenantId, {
  sourceService = 'ai',
  sourceEventId = randomUUID(),
  dimension,
  quantity = 0,
  costCents = 0,
  modelOrVoice,
  latencyMs,
  success = true,
}) {
  const p = getPool();
  if (p) {
    await p.query(
      `INSERT INTO ai_usage_events (tenant_id, source_service, source_event_id, dimension, quantity, cost_cents, model_or_voice, latency_ms, success)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (source_event_id) DO NOTHING`,
      [tenantId, sourceService, sourceEventId, dimension, quantity, costCents, modelOrVoice ?? null, latencyMs ?? null, success],
    );
  }
  const billingDim = BILLING_DIMENSION[dimension] || dimension;
  forwardUsageToBilling({
    tenantId,
    dimension: billingDim,
    quantity,
    sourceService,
    sourceEventId,
  });
}

import { randomUUID } from 'node:crypto';
import { getPool } from '../db.js';
import { createOpenAiAdapter } from './openai-adapter.js';
import { recordUsage } from '../metering.js';

export async function resolveAdapter(tenantId) {
  const p = getPool();
  if (p) {
    const { rows } = await p.query(
      `SELECT * FROM ai_provider_configs WHERE tenant_id = $1 AND provider = 'openai' AND is_active = true LIMIT 1`,
      [tenantId],
    );
    if (rows[0]?.encrypted_api_key) {
      return createOpenAiAdapter({
        apiKey: rows[0].encrypted_api_key,
        baseUrl: rows[0].base_url,
      });
    }
  }
  return createOpenAiAdapter({ apiKey: process.env.OPENAI_API_KEY || '' });
}

export async function resolveModels(tenantId) {
  const p = getPool();
  if (p) {
    const { rows } = await p.query(
      `SELECT model_default, model_fast FROM ai_provider_configs WHERE tenant_id = $1 AND is_active = true LIMIT 1`,
      [tenantId],
    );
    if (rows[0]) {
      return { default: rows[0].model_default, fast: rows[0].model_fast };
    }
  }
  return {
    default: process.env.OPENAI_DEFAULT_MODEL || 'gpt-4o',
    fast: process.env.OPENAI_FAST_MODEL || 'gpt-4o-mini',
  };
}

export async function chatCompletions(tenantId, { messages, model, maxTokens, stream }) {
  const started = Date.now();
  const adapter = await resolveAdapter(tenantId);
  const eventId = randomUUID();
  try {
    const result = await adapter.complete({ messages, model, maxTokens, stream });
    const usage = result.usage ?? {};
    await recordUsage(tenantId, {
      sourceEventId: eventId,
      dimension: 'llm_input_token',
      quantity: usage.prompt_tokens ?? 0,
      modelOrVoice: model || adapter.name,
      latencyMs: Date.now() - started,
    });
    await recordUsage(tenantId, {
      sourceEventId: `${eventId}-out`,
      dimension: 'llm_output_token',
      quantity: usage.completion_tokens ?? 0,
      modelOrVoice: model || adapter.name,
      latencyMs: Date.now() - started,
    });
    return { ...result, provider: adapter.name };
  } catch (e) {
    await recordUsage(tenantId, {
      sourceEventId: eventId,
      dimension: 'llm_error',
      quantity: 0,
      modelOrVoice: model,
      latencyMs: Date.now() - started,
      success: false,
    });
    throw e;
  }
}

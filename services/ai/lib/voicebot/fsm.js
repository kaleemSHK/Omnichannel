import { getPool } from '../db.js';
import { transcribeAudio } from '../stt/adapter.js';
import { synthesize } from '../tts/piper.js';
import { parseJsonFromLlm } from '../llm/openai-adapter.js';
import { chatCompletions, resolveModels } from '../llm/gateway.js';
import { queryRag } from '../rag/service.js';
import { redact } from '../pii/redactor.js';
import { loadConfig, evaluateHandoff } from '../bot-routing.js';

const INTENT_PROMPT = `Detect intent for Arabic telecom IVR. Reply JSON only:
{"intent":"billing_inquiry|technical_support|plan_change|complaint|unrecognized","response_ar":"short Arabic reply","needs_rag":false}`;

/** Fallback transfer phrase if no action.message is configured */
const TRANSFER_PHRASE = 'جاري تحويلك إلى أحد موظفينا، يرجى الانتظار.';
export const ARABIC_GREETING = 'مرحباً بك في بلينك ون، كيف يمكنني مساعدتك؟';

export async function findSessionByCallId(tenantId, callId) {
  const p = getPool();
  if (!p) return null;
  const { rows } = await p.query(
    `SELECT id, tenant_id, call_id, language, state FROM voice_sessions
     WHERE tenant_id = $1 AND call_id = $2 AND ended_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [tenantId, callId],
  );
  return rows[0] ?? null;
}

export async function countActiveSessions(tenantId) {
  const p = getPool();
  if (!p) return 0;
  const { rows } = await p.query(
    `SELECT COUNT(*)::int AS c FROM voice_sessions
     WHERE tenant_id = $1 AND state NOT IN ('ended') AND ended_at IS NULL`,
    [tenantId],
  );
  return rows[0]?.c ?? 0;
}

export async function createSession(tenantId, { call_id, inbox_id, collection_id, language, max_misunderstandings }) {
  const existing = await findSessionByCallId(tenantId, call_id);
  if (existing) {
    return {
      session_id: existing.id,
      greeting_audio_key: null,
      greeting_text: ARABIC_GREETING,
      state: existing.state === 'greeting' ? 'listening' : existing.state,
    };
  }
  const greeting = ARABIC_GREETING;
  const tts = await synthesize({ tenantId, text: greeting });
  const { rows } = await getPool().query(
    `INSERT INTO voice_sessions (tenant_id, call_id, inbox_id, collection_id, language, max_misunderstandings, state)
     VALUES ($1,$2,$3,$4,$5,$6,'greeting') RETURNING *`,
    [tenantId, call_id, inbox_id, collection_id ?? null, language || 'ar-OM', max_misunderstandings ?? 3],
  );
  return {
    session_id: rows[0].id,
    greeting_audio_key: tts.audio_minio_key,
    greeting_text: greeting,
    state: 'listening',
  };
}

export async function processTurn(tenantId, sessionId, {
  audio_minio_key,
  recording_url,
  speech_result,
  barge_in,
}) {
  const p = getPool();
  const { rows } = await p.query('SELECT * FROM voice_sessions WHERE id = $1 AND tenant_id = $2', [sessionId, tenantId]);
  if (!rows.length) {
    const err = new Error('Session not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  const session = rows[0];
  if (session.state === 'ended' || session.state === 'transferring') {
    return { session_id: sessionId, state: session.state, transcript: null };
  }

  const turnIndex = (await p.query('SELECT COUNT(*)::int AS c FROM voice_turns WHERE session_id = $1', [sessionId])).rows[0].c;
  let resolvedAudioKey = audio_minio_key;
  if (recording_url && !resolvedAudioKey) {
    const { ingestRecordingUrl } = await import('../stt/adapter.js');
    resolvedAudioKey = await ingestRecordingUrl(tenantId, recording_url);
  }
  const sttStart = Date.now();
  let stt;
  if (speech_result?.trim()) {
    stt = {
      transcript: speech_result.trim(),
      detected_language: session.language,
      words: [],
    };
  } else {
    stt = await transcribeAudio({
      tenantId,
      audioMinioKey: resolvedAudioKey,
      languageHint: session.language,
    });
  }
  const sttMs = Date.now() - sttStart;

  const models = await resolveModels(tenantId);
  const llmStart = Date.now();
  const { content } = await chatCompletions(tenantId, {
    messages: [
      { role: 'system', content: INTENT_PROMPT },
      { role: 'user', content: redact(stt.transcript) },
    ],
    model: models.fast,
    maxTokens: 300,
  });
  const llmMs = Date.now() - llmStart;
  let parsed = { intent: 'unrecognized', response_ar: 'عذراً، لم أفهم.', needs_rag: false };
  try {
    parsed = parseJsonFromLlm(content);
  } catch {
    /* keep unrecognized */
  }

  let intent = parsed.intent || 'unrecognized';
  let responseText = parsed.response_ar || '';
  let state = 'responding';
  let transferQueue = null;
  let misc = session.misunderstanding_count;

  // Increment misunderstanding count for unrecognized intent (pre-evaluation)
  if (intent === 'unrecognized') misc += 1;

  // A01: evaluate bot routing rules (replaces hard-coded intent/misc logic)
  const routingConfig = await loadConfig(tenantId).catch(() => ({ rules: [] }));
  const handoff = evaluateHandoff(session, { intent, transcript: stt.transcript, misunderstanding_count: misc }, routingConfig.rules);

  if (handoff.matched) {
    if (handoff.action?.type === 'end_call') {
      state = 'ended';
      responseText = handoff.action.message || 'شكراً لتواصلك معنا. وداعاً.';
      transferQueue = null;
    } else {
      // transfer_to_agent (default)
      state = 'transferring';
      transferQueue = handoff.action?.queueKey ?? 'default';
      responseText = handoff.action?.message ?? TRANSFER_PHRASE;
    }
  } else if (parsed.needs_rag && session.collection_id) {
    const { chunks } = await queryRag(tenantId, {
      collection_id: session.collection_id,
      query: stt.transcript,
      top_k: 2,
    });
    if (chunks[0]) responseText = chunks[0].content.slice(0, 400);
  }

  if (barge_in) state = 'listening';

  const ttsStart = Date.now();
  let responseAudioKey = null;
  if (responseText && state !== 'ended') {
    const tts = await synthesize({ tenantId, text: responseText });
    responseAudioKey = tts.audio_minio_key;
  }
  const ttsMs = Date.now() - ttsStart;

  if (state === 'transferring' || state === 'ended') {
    await p.query(
      `UPDATE voice_sessions SET state = $2, misunderstanding_count = $3, transfer_to_queue_id = $4, ended_at = now() WHERE id = $1`,
      [sessionId, state, misc, transferQueue],
    );
  } else {
    await p.query(
      `UPDATE voice_sessions SET state = 'listening', misunderstanding_count = $2 WHERE id = $1`,
      [sessionId, misc],
    );
  }

  await p.query(
    `INSERT INTO voice_turns (session_id, turn_index, audio_minio_key, transcript, intent, response_text, response_audio_key, barge_in, stt_latency_ms, llm_latency_ms, tts_latency_ms)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [sessionId, turnIndex, audio_minio_key, stt.transcript, intent, responseText, responseAudioKey, !!barge_in, sttMs, llmMs, ttsMs],
  );

  return {
    session_id: sessionId,
    state: state === 'responding' ? 'listening' : state,
    transcript: stt.transcript,
    intent,
    response_text: responseText,
    response_audio_key: responseAudioKey,
    transfer_to_queue_id: transferQueue,
    transfer_to_queue: transferQueue,
    escalate: state === 'transferring',
    end_call: state === 'ended',
    response: responseText,
    queue: transferQueue,
    misunderstanding_count: misc,
    // A01: which rule triggered handoff (if any)
    handoff_rule: handoff.matched ? handoff.rule?.name ?? null : null,
  };
}

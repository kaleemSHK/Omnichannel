import { getPool } from '../db.js';
import { transcribeAudio } from '../stt/adapter.js';
import { synthesize } from '../tts/piper.js';
import { parseJsonFromLlm } from '../llm/openai-adapter.js';
import { chatCompletions, resolveModels } from '../llm/gateway.js';
import { queryRag } from '../rag/service.js';
import { redact } from '../pii/redactor.js';

const INTENT_PROMPT = `Detect intent for Arabic telecom IVR. Reply JSON only:
{"intent":"billing_inquiry|technical_support|plan_change|complaint|unrecognized","response_ar":"short Arabic reply","needs_rag":false}`;

const TRANSFER_PHRASE = 'جاري تحويلك إلى أحد موظفينا، يرجى الانتظار.';

export async function createSession(tenantId, { call_id, inbox_id, collection_id, language, max_misunderstandings }) {
  const greeting = 'مرحباً بك في بلينك ون، كيف يمكنني مساعدتك؟';
  const tts = await synthesize({ tenantId, text: greeting });
  const { rows } = await getPool().query(
    `INSERT INTO voice_sessions (tenant_id, call_id, inbox_id, collection_id, language, max_misunderstandings, state)
     VALUES ($1,$2,$3,$4,$5,$6,'greeting') RETURNING *`,
    [tenantId, call_id, inbox_id, collection_id ?? null, language || 'ar-OM', max_misunderstandings ?? 3],
  );
  return {
    session_id: rows[0].id,
    greeting_audio_key: tts.audio_minio_key,
    state: 'listening',
  };
}

export async function processTurn(tenantId, sessionId, { audio_minio_key, barge_in }) {
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
  const sttStart = Date.now();
  const stt = await transcribeAudio({
    tenantId,
    audioMinioKey: audio_minio_key,
    languageHint: session.language,
  });
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

  if (intent === 'complaint') {
    state = 'transferring';
    transferQueue = 'support';
    responseText = TRANSFER_PHRASE;
  } else if (intent === 'unrecognized') {
    misc += 1;
    if (misc >= session.max_misunderstandings) {
      state = 'transferring';
      transferQueue = 'default';
      responseText = TRANSFER_PHRASE;
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

  if (state === 'transferring') {
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
    misunderstanding_count: misc,
  };
}

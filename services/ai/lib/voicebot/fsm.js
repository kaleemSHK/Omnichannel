import { getPool } from '../db.js';
import { transcribeAudio } from '../stt/adapter.js';
import { synthesize } from '../tts/piper.js';
import { parseJsonFromLlm } from '../llm/openai-adapter.js';
import { chatCompletions, resolveModels } from '../llm/gateway.js';
import { queryRag } from '../rag/service.js';
import { redact } from '../pii/redactor.js';
import { loadConfig, evaluateHandoff } from '../bot-routing.js';

/**
 * V1 — Intent prompt now includes confidence (0.0–1.0) so we can detect
 * low-confidence turns and prompt for clarification instead of incrementing
 * the misunderstanding counter.
 */
const INTENT_PROMPT = `Detect intent for Arabic telecom IVR. Reply JSON only:
{"intent":"billing_inquiry|technical_support|plan_change|complaint|unrecognized","confidence":0.95,"response_ar":"short Arabic reply","needs_rag":false}
Rules:
- confidence: float 0.0–1.0 reflecting how certain you are of the detected intent
- Set confidence < 0.5 when transcript is empty, too short, or genuinely ambiguous
- needs_rag: true only for specific product/plan questions that require knowledge base lookup`;

/** Fallback transfer phrase if no action.message is configured */
const TRANSFER_PHRASE = 'جاري تحويلك إلى أحد موظفينا، يرجى الانتظار.';
/** Hold-music cue synthesized when entering transferring state */
const HOLD_PHRASE = 'جاري تحويلك إلى أحد موظفينا. يرجى الانتظار، سيتم الرد عليك قريباً.';
export const ARABIC_GREETING = 'مرحباً بك في بلينك ون، كيف يمكنني مساعدتك؟';

/** V1 — Ask for clarification when confidence is below threshold */
const CLARIFY_RESPONSE = 'عذراً، لم أتمكن من فهم طلبك بوضوح. هل يمكنك إعادة الصياغة؟ أو اضغط: 1 للفواتير، 2 للدعم الفني، 9 للتحدث مع موظف.';

/** V1 — Confidence threshold below which we ask for clarification (not misunderstanding) */
const CONFIDENCE_THRESHOLD = 0.55;

/** V1 — DTMF digit → intent mapping (keypad-driven fallback) */
const DTMF_INTENT_MAP = {
  '1': 'billing_inquiry',
  '2': 'technical_support',
  '3': 'plan_change',
  '9': 'human_request',
};

const DTMF_RESPONSE_MAP = {
  '1': 'تم اختيار الاستفسار عن الفاتورة.',
  '2': 'تم اختيار الدعم الفني.',
  '3': 'تم اختيار تغيير الخطة.',
  '9': 'جاري تحويلك إلى أحد موظفينا.',
};

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

/**
 * V1 enhanced processTurn
 * New params:
 *   dtmf_digit?: '1'|'2'|'3'|'9'  — DTMF keypad input (bypasses STT + LLM)
 */
export async function processTurn(tenantId, sessionId, {
  audio_minio_key,
  recording_url,
  speech_result,
  barge_in,
  dtmf_digit,            // V1: DTMF fallback
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
  let sttMs = 0;
  let llmMs = 0;
  let transcript = '';
  let intent = 'unrecognized';
  let responseText = '';
  let confidence = 1.0;
  let lowConfidence = false;

  // ── V1: DTMF path (bypasses STT + LLM entirely) ─────────────────────────────
  if (dtmf_digit && DTMF_INTENT_MAP[dtmf_digit]) {
    intent = DTMF_INTENT_MAP[dtmf_digit];
    transcript = `[DTMF:${dtmf_digit}]`;
    responseText = DTMF_RESPONSE_MAP[dtmf_digit];
    confidence = 1.0;
  } else {
    // ── STT ──────────────────────────────────────────────────────────────────
    let resolvedAudioKey = audio_minio_key;
    if (recording_url && !resolvedAudioKey) {
      const { ingestRecordingUrl } = await import('../stt/adapter.js');
      resolvedAudioKey = await ingestRecordingUrl(tenantId, recording_url);
    }
    const sttStart = Date.now();
    let stt;
    if (speech_result?.trim()) {
      stt = { transcript: speech_result.trim(), detected_language: session.language, words: [] };
    } else {
      stt = await transcribeAudio({
        tenantId,
        audioMinioKey: resolvedAudioKey,
        languageHint: session.language,
      });
    }
    sttMs = Date.now() - sttStart;
    transcript = stt.transcript;

    // ── LLM intent detection ─────────────────────────────────────────────────
    const models = await resolveModels(tenantId);
    const llmStart = Date.now();
    const { content } = await chatCompletions(tenantId, {
      messages: [
        { role: 'system', content: INTENT_PROMPT },
        { role: 'user', content: redact(transcript) },
      ],
      model: models.fast,
      maxTokens: 300,
    });
    llmMs = Date.now() - llmStart;

    let parsed = { intent: 'unrecognized', confidence: 0.0, response_ar: 'عذراً، لم أفهم.', needs_rag: false };
    try {
      parsed = parseJsonFromLlm(content);
    } catch {
      /* keep unrecognized */
    }

    intent = parsed.intent || 'unrecognized';
    confidence = typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 1.0;
    responseText = parsed.response_ar || '';

    // ── V1: Confidence threshold — low-confidence → ask for clarification ────
    // This is distinct from "unrecognized": we understood something but aren't
    // sure enough; we prompt for clarification WITHOUT incrementing misc count.
    if (intent !== 'unrecognized' && confidence < CONFIDENCE_THRESHOLD) {
      lowConfidence = true;
      intent = 'unrecognized'; // treat as unrecognized for routing purposes
      responseText = CLARIFY_RESPONSE;
      // Do NOT increment misunderstanding_count here — it's a confidence issue,
      // not a genuine misunderstanding. Let the user retry.
    } else if (parsed.needs_rag && session.collection_id) {
      // RAG enrichment (runs before routing so response_text can be overridden)
      try {
        const { chunks } = await queryRag(tenantId, {
          collection_id: session.collection_id,
          query: transcript,
          top_k: 2,
        });
        if (chunks?.[0]) responseText = chunks[0].content.slice(0, 400);
      } catch {
        /* RAG optional */
      }
    }
  }

  let state = 'responding';
  let transferQueue = null;
  let misc = session.misunderstanding_count;

  // Increment misunderstanding count only for genuine unrecognized intent
  // (lowConfidence = true means we already set intent to 'unrecognized' but
  //  skip the counter so max_misunderstandings isn't exhausted unfairly)
  if (intent === 'unrecognized' && !lowConfidence) misc += 1;

  // ── Bot routing evaluation ───────────────────────────────────────────────────
  const routingConfig = await loadConfig(tenantId).catch(() => ({ rules: [] }));
  const handoff = evaluateHandoff(
    session,
    { intent, transcript, misunderstanding_count: misc },
    routingConfig.rules,
  );

  let holdAudioKey = null;

  if (handoff.matched) {
    if (handoff.action?.type === 'end_call') {
      state = 'ended';
      responseText = handoff.action.message || 'شكراً لتواصلك معنا. وداعاً.';
      transferQueue = null;
    } else {
      // transfer_to_agent
      state = 'transferring';
      transferQueue = handoff.action?.queueKey ?? 'default';
      responseText = handoff.action?.message ?? TRANSFER_PHRASE;
    }
  }

  if (barge_in) state = 'listening';

  // ── V1: Synthesize hold cue when entering transferring state ─────────────────
  const ttsStart = Date.now();
  let responseAudioKey = null;
  if (state === 'transferring') {
    try {
      const holdTts = await synthesize({ tenantId, text: HOLD_PHRASE });
      holdAudioKey = holdTts.audio_minio_key;
      // For transferring, use the hold phrase as the primary response audio
      responseAudioKey = holdAudioKey;
    } catch {
      /* hold audio optional */
    }
  } else if (responseText && state !== 'ended') {
    const tts = await synthesize({ tenantId, text: responseText });
    responseAudioKey = tts.audio_minio_key;
  }
  const ttsMs = Date.now() - ttsStart;

  // ── DB updates ────────────────────────────────────────────────────────────────
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
    [sessionId, turnIndex, audio_minio_key, transcript, intent, responseText, responseAudioKey, !!barge_in, sttMs, llmMs, ttsMs],
  );

  return {
    session_id: sessionId,
    state: state === 'responding' ? 'listening' : state,
    transcript,
    intent,
    confidence,
    low_confidence: lowConfidence,
    response_text: responseText,
    response_audio_key: responseAudioKey,
    hold_audio_key: holdAudioKey,           // V1: hold cue for transfer
    transfer_to_queue_id: transferQueue,
    transfer_to_queue: transferQueue,
    escalate: state === 'transferring',
    end_call: state === 'ended',
    response: responseText,
    queue: transferQueue,
    misunderstanding_count: misc,
    handoff_rule: handoff.matched ? handoff.rule?.name ?? null : null,
    dtmf_driven: !!dtmf_digit,             // V1: flag DTMF-driven turns
  };
}

// ─── V1: Analytics ────────────────────────────────────────────────────────────

/**
 * Aggregate voicebot KPIs for a time window.
 * All date filtering uses voice_sessions.created_at (the session start time).
 * voice_turns are joined via session_id — no separate date column needed.
 *
 * @param {number} tenantId
 * @param {string} since  ISO string
 * @param {string} until  ISO string
 */
export async function getVoicebotAnalytics(tenantId, since, until) {
  const p = getPool();
  if (!p) return null;

  // ── Session-level aggregates ────────────────────────────────────────────────
  const { rows: [sess] } = await p.query(`
    SELECT
      COUNT(*)::int                                                          AS total_sessions,
      COUNT(*) FILTER (WHERE state = 'transferring')::int                   AS escalated_sessions,
      COUNT(*) FILTER (WHERE state = 'ended')::int                          AS completed_sessions,
      ROUND(AVG(misunderstanding_count)::numeric, 1)::float                 AS avg_misunderstandings
    FROM voice_sessions
    WHERE tenant_id = $1 AND created_at BETWEEN $2 AND $3
  `, [tenantId, since, until]);

  // ── Intent distribution (all turns in window) ───────────────────────────────
  const { rows: intentRows } = await p.query(`
    SELECT vt.intent, COUNT(*)::int AS count
    FROM voice_turns vt
    JOIN voice_sessions vs ON vs.id = vt.session_id
    WHERE vs.tenant_id = $1 AND vs.created_at BETWEEN $2 AND $3
    GROUP BY vt.intent
    ORDER BY count DESC
  `, [tenantId, since, until]);

  // ── Avg turns-to-handoff (sessions that ended or transferred) ───────────────
  const { rows: turnRows } = await p.query(`
    SELECT COUNT(vt.id)::int AS turn_count
    FROM voice_sessions vs
    JOIN voice_turns vt ON vt.session_id = vs.id
    WHERE vs.tenant_id = $1 AND vs.created_at BETWEEN $2 AND $3
      AND vs.state IN ('transferring', 'ended')
    GROUP BY vs.id
  `, [tenantId, since, until]);
  const avgTurns = turnRows.length
    ? Math.round((turnRows.reduce((s, r) => s + r.turn_count, 0) / turnRows.length) * 10) / 10
    : 0;

  // ── Latency stats ────────────────────────────────────────────────────────────
  const { rows: [lat] } = await p.query(`
    SELECT
      COALESCE(ROUND(AVG(stt_latency_ms))::int, 0)  AS avg_stt_ms,
      COALESCE(ROUND(AVG(llm_latency_ms))::int, 0)  AS avg_llm_ms,
      COALESCE(ROUND(AVG(tts_latency_ms))::int, 0)  AS avg_tts_ms
    FROM voice_turns vt
    JOIN voice_sessions vs ON vs.id = vt.session_id
    WHERE vs.tenant_id = $1 AND vs.created_at BETWEEN $2 AND $3
  `, [tenantId, since, until]);

  // ── Daily session counts ─────────────────────────────────────────────────────
  const { rows: dailyRows } = await p.query(`
    SELECT DATE(created_at)::text AS date, COUNT(*)::int AS sessions
    FROM voice_sessions
    WHERE tenant_id = $1 AND created_at BETWEEN $2 AND $3
    GROUP BY DATE(created_at)
    ORDER BY date
  `, [tenantId, since, until]);

  const total = sess?.total_sessions ?? 0;
  const escalated = sess?.escalated_sessions ?? 0;

  return {
    total_sessions:       total,
    escalated_sessions:   escalated,
    completed_sessions:   sess?.completed_sessions ?? 0,
    avg_misunderstandings: sess?.avg_misunderstandings ?? 0,
    avg_turns_to_handoff: avgTurns,
    escalation_rate:      total > 0 ? Math.round((escalated / total) * 1000) / 10 : 0,
    intent_distribution:  intentRows,
    avg_stt_ms:           lat?.avg_stt_ms ?? 0,
    avg_llm_ms:           lat?.avg_llm_ms ?? 0,
    avg_tts_ms:           lat?.avg_tts_ms ?? 0,
    daily_sessions:       dailyRows,
  };
}

/**
 * Return the full transcript (session metadata + ordered turns) for one session.
 */
export async function getSessionTranscript(tenantId, sessionId) {
  const p = getPool();
  if (!p) return null;
  const { rows: [session] } = await p.query(
    `SELECT id, call_id, state, language, created_at, ended_at,
            misunderstanding_count, transfer_to_queue_id
     FROM voice_sessions WHERE id = $1 AND tenant_id = $2`,
    [sessionId, tenantId],
  );
  if (!session) return null;
  const { rows: turns } = await p.query(
    `SELECT turn_index, transcript, intent, response_text, barge_in,
            stt_latency_ms, llm_latency_ms, tts_latency_ms
     FROM voice_turns WHERE session_id = $1 ORDER BY turn_index ASC`,
    [sessionId],
  );
  return { session, turns };
}

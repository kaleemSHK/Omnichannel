import { getPool } from '../db.js';
import { getObjectBytes, audioKey, putObject } from '../minio.js';
import { recordUsage } from '../metering.js';
import { whisperTranscribe } from './whisper.js';

const LANGUAGE_CODES = ['ar-OM', 'ar-SA', 'ar-JO', 'ar-EG', 'ar'];

function stubResult(languageHint) {
  const transcript =
    process.env.STT_STUB_TRANSCRIPT || 'مرحبا، أبي مساعدة بخصوص الانترنت';
  return {
    transcript,
    detected_language: languageHint || 'ar-OM',
    words: transcript.split(/\s+/).filter(Boolean).map((w, i) => ({
      word: w,
      start_time: i * 0.4,
      end_time: (i + 1) * 0.4,
      speaker_tag: 0,
    })),
  };
}

function googleConfigured() {
  return (
    process.env.GOOGLE_STT_STUB !== '1' &&
    process.env.GOOGLE_APPLICATION_CREDENTIALS &&
    process.env.GOOGLE_STT_PROJECT_ID
  );
}

function whisperConfigured() {
  return (
    process.env.STT_PROVIDER === 'whisper' ||
    process.env.WHISPER_STT_ENABLED === '1' ||
    (process.env.WHISPER_STT_URL && process.env.STT_PROVIDER !== 'google')
  );
}

/** Active STT backend: whisper | google | stub */
export function resolveSttProvider() {
  const forced = (process.env.STT_PROVIDER || '').toLowerCase();
  if (forced === 'stub' || process.env.GOOGLE_STT_STUB === '1' && forced !== 'whisper' && forced !== 'google') {
    if (forced === 'whisper' || whisperConfigured()) return 'whisper';
    return 'stub';
  }
  if (forced === 'whisper' || (whisperConfigured() && !googleConfigured())) return 'whisper';
  if (forced === 'google' || googleConfigured()) return 'google';
  if (whisperConfigured()) return 'whisper';
  return 'stub';
}

export function sttModeLabel() {
  const p = resolveSttProvider();
  if (p === 'google') return 'google_chirp_v2';
  if (p === 'whisper') return `whisper_${process.env.WHISPER_MODEL || 'small'}`;
  return 'stub';
}

async function loadAudioBuffer({ audioMinioKey, audioBuffer }) {
  if (audioBuffer?.length) return audioBuffer;
  if (!audioMinioKey) return null;
  const parts = String(audioMinioKey).split('/');
  const bucket = parts[0];
  const key = parts.slice(1).join('/');
  return getObjectBytes(bucket, key);
}

/** Ingest Twilio/recording URL into MinIO for STT pipeline */
export async function ingestRecordingUrl(tenantId, recordingUrl) {
  const url = String(recordingUrl).replace(/\/$/, '');
  const fetchUrl = url.endsWith('.wav') ? url : `${url}.wav`;
  const res = await fetch(fetchUrl);
  if (!res.ok) throw new Error(`Recording fetch failed ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const key = audioKey(tenantId, 'stt-inbound', 'wav');
  const bucket = process.env.MINIO_BUCKET_AUDIO || 'blinkone-audio';
  await putObject(bucket, key, buf, 'audio/wav');
  return `${bucket}/${key}`;
}

async function googleTranscribe(buffer, languageHint) {
  const project = process.env.GOOGLE_STT_PROJECT_ID;
  const location = process.env.GOOGLE_STT_LOCATION || 'global';
  const recognizer = `projects/${project}/locations/${location}/recognizers/_`;

  let SpeechClient;
  try {
    ({ SpeechClient } = await import('@google-cloud/speech'));
  } catch (e) {
    throw new Error(`@google-cloud/speech not installed: ${e.message}`);
  }

  const client = new SpeechClient();
  const hint = languageHint || 'ar-OM';
  const languageCodes = LANGUAGE_CODES.includes(hint) ? [hint, 'ar'] : [hint, ...LANGUAGE_CODES];

  const request = {
    recognizer,
    config: {
      autoDecodingConfig: {},
      languageCodes,
      model: process.env.GOOGLE_STT_MODEL || 'chirp_2',
      features: {
        enableAutomaticPunctuation: true,
        enableWordConfidence: false,
      },
    },
    content: buffer,
  };

  const [response] = await client.recognize(request);
  const transcript =
    response.results
      ?.map((r) => r.alternatives?.[0]?.transcript ?? '')
      .filter(Boolean)
      .join(' ')
      .trim() || '';

  const words = [];
  for (const result of response.results ?? []) {
    for (const alt of result.alternatives ?? []) {
      for (const w of alt.words ?? []) {
        words.push({
          word: w.word,
          start_time: Number(w.startOffset?.seconds ?? 0),
          end_time: Number(w.endOffset?.seconds ?? 0),
          speaker_tag: w.speakerTag ?? 0,
        });
      }
    }
  }

  return {
    transcript: transcript || stubResult(languageHint).transcript,
    detected_language: languageCodes[0],
    words,
  };
}

async function transcribeWithProvider(buffer, languageHint, provider) {
  if (provider === 'whisper') {
    const result = await whisperTranscribe(buffer, languageHint);
    if (!result.transcript && process.env.WHISPER_FALLBACK_STUB === '1') {
      return stubResult(languageHint);
    }
    return result;
  }
  if (provider === 'google') {
    return googleTranscribe(buffer, languageHint);
  }
  return stubResult(languageHint);
}

/** STT — Whisper (local), Google Chirp v2, or stub */
export async function transcribeAudio({
  tenantId,
  audioMinioKey,
  audioBuffer,
  languageHint,
  contextPhrases,
}) {
  void contextPhrases;

  const provider = resolveSttProvider();

  if (provider === 'stub') {
    await recordUsage(tenantId, {
      dimension: 'stt_second',
      quantity: 5,
      modelOrVoice: 'stub',
      success: true,
    });
    return stubResult(languageHint);
  }

  const buffer = await loadAudioBuffer({ audioMinioKey, audioBuffer });
  if (!buffer?.length) {
    return stubResult(languageHint);
  }

  try {
    const result = await transcribeWithProvider(buffer, languageHint, provider);
    const durationSec = Math.max(1, Math.ceil(buffer.length / 16000));
    const model =
      provider === 'whisper'
        ? `whisper/${process.env.WHISPER_MODEL || 'small'}`
        : process.env.GOOGLE_STT_MODEL || 'chirp_2';
    await recordUsage(tenantId, {
      dimension: 'stt_second',
      quantity: durationSec,
      modelOrVoice: model,
      success: true,
    });
    if (!result.transcript?.trim() && process.env.STT_FALLBACK_STUB === '1') {
      return stubResult(languageHint);
    }
    return result;
  } catch (e) {
    if (process.env.STT_FALLBACK_STUB === '1' || process.env.WHISPER_FALLBACK_STUB === '1') {
      return stubResult(languageHint);
    }
    throw e;
  }
}

export async function processSttJob(jobId) {
  const p = getPool();
  const { rows } = await p.query('SELECT * FROM stt_jobs WHERE id = $1', [jobId]);
  if (!rows.length) return;
  const job = rows[0];
  await p.query(`UPDATE stt_jobs SET status = 'processing' WHERE id = $1`, [jobId]);
  try {
    const result = await transcribeAudio({
      tenantId: job.tenant_id,
      audioMinioKey: job.audio_minio_key,
      languageHint: job.language_hint,
      contextPhrases: job.context_phrases,
    });
    await p.query(
      `UPDATE stt_jobs SET status = 'completed', transcript = $2, words = $3::jsonb,
       detected_language = $4, completed_at = now() WHERE id = $1`,
      [jobId, result.transcript, JSON.stringify(result.words ?? []), result.detected_language],
    );
  } catch (e) {
    await p.query(
      `UPDATE stt_jobs SET status = 'failed', error_message = $2, completed_at = now() WHERE id = $1`,
      [jobId, e.message],
    );
  }
}

export function startSttWorker(intervalMs = 3000) {
  if (process.env.STT_WORKER === '0') return;
  setInterval(async () => {
    const p = getPool();
    if (!p) return;
    const { rows } = await p.query(
      `SELECT id FROM stt_jobs WHERE status = 'queued' ORDER BY created_at LIMIT 3`,
    );
    for (const r of rows) {
      try {
        await processSttJob(r.id);
      } catch {
        /* logged in processSttJob */
      }
    }
  }, intervalMs);
}

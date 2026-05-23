import { getPool } from '../db.js';
import { recordUsage } from '../metering.js';

/** Google Cloud STT v2 — stub when no credentials */
export async function transcribeAudio({ tenantId, audioMinioKey, languageHint, contextPhrases }) {
  const creds = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const project = process.env.GOOGLE_STT_PROJECT_ID;

  if (!creds || !project || process.env.GOOGLE_STT_STUB === '1') {
    const transcript =
      process.env.STT_STUB_TRANSCRIPT ||
      'مرحبا، أبي مساعدة بخصوص الانترنت';
    await recordUsage(tenantId, { dimension: 'stt_second', quantity: 5, modelOrVoice: 'stub', success: true });
    return {
      transcript,
      detected_language: languageHint || 'ar-OM',
      words: transcript.split(/\s+/).map((w, i) => ({
        word: w,
        start_time: i * 0.4,
        end_time: (i + 1) * 0.4,
        speaker_tag: 0,
      })),
    };
  }

  // Production: @google-cloud/speech v2 client
  throw new Error('Google STT credentials required — set GOOGLE_STT_STUB=1 for dev');
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

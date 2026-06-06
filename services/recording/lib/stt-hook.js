const AI_URL = (process.env.AI_URL || 'http://ai:8793').replace(/\/$/, '');
const AI_TOKEN = (process.env.AI_TOKEN || '').trim();
const BUCKET = process.env.MINIO_BUCKET || 'recordings';

/**
 * Queue post-call transcription when a recording lands in MinIO.
 * Requires AUTO_STT_ON_RECORDING=1 and AI service Postgres.
 */
export async function enqueueRecordingTranscription({ tenantId, storageKey, callSessionId, log }) {
  if (process.env.AUTO_STT_ON_RECORDING !== '1' || !AI_TOKEN || !storageKey) return;

  const audioMinioKey = `${BUCKET}/${storageKey}`;

  try {
    const res = await fetch(`${AI_URL}/v1/stt/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AI_TOKEN}`,
        'X-Blinkone-Tenant-Id': String(tenantId),
      },
      body: JSON.stringify({
        audio_minio_key: audioMinioKey,
        language_hint: process.env.STT_LANGUAGE_HINT || 'ar-OM',
        diarize: true,
        context_phrases: callSessionId ? [`call:${callSessionId}`] : [],
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      log?.warn?.({ status: res.status, text: text.slice(0, 120) }, 'stt enqueue failed');
      return;
    }
    const body = await res.json().catch(() => ({}));
    log?.info?.({ jobId: body?.data?.job_id, callSessionId }, 'stt job queued');
  } catch (e) {
    log?.warn?.({ err: e.message, callSessionId }, 'stt enqueue error');
  }
}

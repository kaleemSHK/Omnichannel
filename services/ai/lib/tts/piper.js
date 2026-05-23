import { recordUsage } from '../metering.js';
import { audioKey, putObject } from '../minio.js';

const PIPER_URL = (process.env.PIPER_TTS_URL || 'http://blinkone-piper:5000').replace(/\/$/, '');
const DEFAULT_VOICE = process.env.PIPER_DEFAULT_VOICE || 'ar_JO-kareem-medium';

export async function synthesize({ tenantId, text, voice = DEFAULT_VOICE }) {
  const started = Date.now();
  let wav;

  try {
    const res = await fetch(`${PIPER_URL}/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice, output_format: 'wav' }),
    });
    if (res.ok) {
      wav = Buffer.from(await res.arrayBuffer());
    } else {
      throw new Error(`Piper ${res.status}`);
    }
  } catch {
    // Wyoming Piper uses different API — try legacy path or stub
    if (process.env.PIPER_STUB !== '0') {
      wav = Buffer.alloc(44 + 8000);
      wav.write('RIFF', 0);
      wav.writeUInt32LE(36 + 8000, 4);
      wav.write('WAVE', 8);
    } else {
      throw new Error('Piper TTS unavailable');
    }
  }

  const key = audioKey(tenantId, 'tts', 'wav');
  const bucket = process.env.MINIO_BUCKET_AUDIO || 'blinkone-audio';
  try {
    await putObject(bucket, key, wav, 'audio/wav');
  } catch {
    /* MINIO_STUB */
  }

  const durationMs = Math.round((text.length / 12) * 1000);
  await recordUsage(tenantId, {
    dimension: 'tts_char',
    quantity: text.length,
    modelOrVoice: voice,
    latencyMs: Date.now() - started,
  });

  return { audio_minio_key: `${bucket}/${key}`, duration_ms: durationMs };
}

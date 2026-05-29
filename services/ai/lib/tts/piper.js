import net from 'node:net';
import { recordUsage } from '../metering.js';
import { audioKey, putObject } from '../minio.js';

const PIPER_URL = (process.env.PIPER_TTS_URL || 'http://blinkone-piper:5000').replace(/\/$/, '');
const PIPER_HOST = process.env.PIPER_HOST || 'blinkone-piper';
const PIPER_PORT = parseInt(process.env.PIPER_PORT || '10200', 10);
const DEFAULT_VOICE = process.env.PIPER_DEFAULT_VOICE || 'ar_JO-kareem-medium';
const PIPER_STUB = process.env.PIPER_STUB === '1';

function stubWav(text) {
  const wav = Buffer.alloc(44 + 8000);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + 8000, 4);
  wav.write('WAVE', 8);
  wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(22050, 24);
  wav.writeUInt32LE(44100, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(8000, 40);
  void text;
  return wav;
}

async function synthesizeWyoming(text) {
  return new Promise((resolve, reject) => {
    const client = net.createConnection(PIPER_PORT, PIPER_HOST, () => {
      const header = JSON.stringify({ type: 'synthesize', data: { text } });
      client.write(`${header}\n${text}\n`);
    });

    const chunks = [];
    let headerDone = false;

    client.on('data', (chunk) => {
      if (!headerDone) {
        const newline = chunk.indexOf('\n');
        if (newline >= 0) {
          headerDone = true;
          chunks.push(chunk.subarray(newline + 1));
        }
      } else {
        chunks.push(chunk);
      }
    });

    client.on('end', () => resolve(Buffer.concat(chunks)));
    client.on('error', reject);
    setTimeout(() => {
      client.destroy();
      reject(new Error('Piper TTS timeout'));
    }, 10000);
  });
}

async function synthesizeHttp(text, voice) {
  const res = await fetch(`${PIPER_URL}/synthesize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice, output_format: 'wav' }),
  });
  if (!res.ok) throw new Error(`Piper HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function synthesize({ tenantId, text, voice = DEFAULT_VOICE }) {
  const started = Date.now();
  let wav;

  if (PIPER_STUB) {
    wav = stubWav(text);
  } else {
    try {
      wav = await synthesizeHttp(text, voice);
    } catch {
      try {
        wav = await synthesizeWyoming(text);
      } catch {
        if (process.env.PIPER_FALLBACK_STUB === '1') {
          wav = stubWav(text);
        } else {
          throw new Error('Piper TTS unavailable');
        }
      }
    }
  }

  const key = audioKey(tenantId, 'tts', 'wav');
  const bucket = process.env.MINIO_BUCKET_AUDIO || 'blinkone-audio';
  try {
    await putObject(bucket, key, wav, 'audio/wav');
  } catch {
    if (process.env.MINIO_STUB !== '1') throw new Error('MinIO put failed');
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

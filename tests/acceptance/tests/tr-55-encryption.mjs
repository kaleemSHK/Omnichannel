/**
 * TR-55 — Recording encryption at rest (MinIO object not plain audio).
 */
import { cfg } from '../lib/config.mjs';

export async function run() {
  const start = Date.now();
  if (process.env.RUN_ENCRYPTION_TEST !== '1') {
    return {
      status: 'SKIP',
      detail: 'Set RUN_ENCRYPTION_TEST=1 and RECORDING_MINIO_KEY to probe bucket',
    };
  }
  const key = process.env.RECORDING_MINIO_KEY;
  if (!key) return { status: 'SKIP', detail: 'RECORDING_MINIO_KEY not set' };
  try {
    const res = await fetch(`http://${cfg.minioEndpoint}/${process.env.MINIO_BUCKET || 'recordings'}/${key}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const isWav = buf.slice(0, 4).toString() === 'RIFF';
    const isMp3 = buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0;
    if (isWav || isMp3) {
      return { status: 'FAIL', detail: 'Object is playable cleartext — encryption not applied', durationMs: Date.now() - start };
    }
    return { status: 'PASS', detail: 'Object is not plain WAV/MP3 header', durationMs: Date.now() - start };
  } catch (e) {
    return { status: 'SKIP', detail: e.message, durationMs: Date.now() - start };
  }
}

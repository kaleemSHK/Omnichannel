const ENDPOINT = (process.env.MINIO_ENDPOINT || 'http://blinkone-minio:9000').replace(/\/$/, '');
const ACCESS = process.env.MINIO_ACCESS_KEY || process.env.MINIO_ROOT_USER || 'blinkone';
const SECRET = process.env.MINIO_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD || 'blinkone-minio-secret';
const BUCKET = process.env.MINIO_BUCKET || 'recordings';

export function recordingKey(tenantId, callSessionId, ext = 'wav') {
  return `tenants/${tenantId}/calls/${callSessionId}-${Date.now()}.${ext}`;
}

export async function putObject(key, body, contentType = 'audio/wav') {
  const url = `${ENDPOINT}/${BUCKET}/${key}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      Authorization: `Bearer ${ACCESS}:${SECRET}`,
    },
    body,
  });
  if (!res.ok && process.env.MINIO_STUB !== '1') {
    throw new Error(`MinIO put failed ${res.status}`);
  }
  return { bucket: BUCKET, storageKey: `${BUCKET}/${key}` };
}

export { BUCKET };

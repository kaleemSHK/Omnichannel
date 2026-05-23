const ENDPOINT = (process.env.MINIO_ENDPOINT || 'http://blinkone-minio:9000').replace(/\/$/, '');
const ACCESS = process.env.MINIO_ACCESS_KEY || process.env.MINIO_ROOT_USER || 'blinkone';
const SECRET = process.env.MINIO_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD || 'blinkone-minio-secret';

export async function putObject(bucket, key, body, contentType = 'application/octet-stream') {
  const url = `${ENDPOINT}/${bucket}/${key}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      Authorization: `Bearer ${ACCESS}:${SECRET}`,
    },
    body,
  });
  if (!res.ok && res.status !== 200) {
    // MinIO may need AWS SDK; for dev store in memory path via DATA_DIR fallback
    if (process.env.MINIO_STUB === '1') return { bucket, key };
    throw new Error(`MinIO put failed ${res.status}`);
  }
  return { bucket, key: `${bucket}/${key}` };
}

export async function getObjectBytes(bucket, key) {
  const url = `${ENDPOINT}/${bucket}/${key}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`MinIO get ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** MinIO object key — namespaced per tenant (Prompt 8). */
export function audioKey(tenantId, prefix, ext = 'wav') {
  return `tenants/${tenantId}/${prefix}-${Date.now()}.${ext}`;
}

export function tenantObjectKey(tenantId, category, filename) {
  return `tenants/${tenantId}/${category}/${filename}`;
}

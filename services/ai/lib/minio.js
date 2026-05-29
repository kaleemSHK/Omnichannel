import * as Minio from 'minio';

const ENDPOINT = (process.env.MINIO_ENDPOINT || 'http://blinkone-minio:9000').replace(/\/$/, '');
const ACCESS = process.env.MINIO_ACCESS_KEY || process.env.MINIO_ROOT_USER || 'blinkone';
const SECRET = process.env.MINIO_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD || 'blinkone-minio-secret';

let client;

function getClient() {
  if (process.env.MINIO_STUB === '1') return null;
  if (!client) {
    const url = new URL(ENDPOINT.startsWith('http') ? ENDPOINT : `http://${ENDPOINT}`);
    client = new Minio.Client({
      endPoint: url.hostname,
      port: url.port ? parseInt(url.port, 10) : url.protocol === 'https:' ? 443 : 80,
      useSSL: url.protocol === 'https:',
      accessKey: ACCESS,
      secretKey: SECRET,
    });
  }
  return client;
}

export async function putObject(bucket, key, body, contentType = 'application/octet-stream') {
  if (process.env.MINIO_STUB === '1') return { bucket, key: `${bucket}/${key}` };
  const minio = getClient();
  if (!minio) throw new Error('MinIO not configured');
  await minio.putObject(bucket, key, body, body.length, { 'Content-Type': contentType });
  return { bucket, key: `${bucket}/${key}` };
}

export async function getObjectBytes(bucket, key) {
  if (process.env.MINIO_STUB === '1') return Buffer.alloc(0);
  const minio = getClient();
  if (!minio) throw new Error('MinIO not configured');
  const stream = await minio.getObject(bucket, key);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export function audioKey(tenantId, prefix, ext = 'wav') {
  return `tenants/${tenantId}/${prefix}-${Date.now()}.${ext}`;
}

export function tenantObjectKey(tenantId, category, filename) {
  return `tenants/${tenantId}/${category}/${filename}`;
}

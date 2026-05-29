import * as Minio from 'minio';

const ENDPOINT = (process.env.MINIO_ENDPOINT || 'http://blinkone-minio:9000').replace(/\/$/, '');
const PUBLIC_ENDPOINT = (process.env.MINIO_PUBLIC_ENDPOINT || ENDPOINT).replace(/\/$/, '');
const ACCESS = process.env.MINIO_ACCESS_KEY || process.env.MINIO_ROOT_USER || 'blinkone';
const SECRET = process.env.MINIO_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD || 'blinkone-minio-secret';
export const BUCKET = process.env.MINIO_BUCKET || 'recordings';

let client;

function parseEndpoint(raw) {
  const url = new URL(raw.startsWith('http') ? raw : `http://${raw}`);
  return {
    endPoint: url.hostname,
    port: url.port ? parseInt(url.port, 10) : url.protocol === 'https:' ? 443 : 80,
    useSSL: url.protocol === 'https:',
  };
}

export function getMinioClient() {
  if (process.env.MINIO_STUB === '1') return null;
  if (!client) {
    const { endPoint, port, useSSL } = parseEndpoint(ENDPOINT);
    client = new Minio.Client({ endPoint, port, useSSL, accessKey: ACCESS, secretKey: SECRET });
  }
  return client;
}

export function recordingKey(tenantId, callSessionId, ext = 'wav') {
  const day = new Date().toISOString().slice(0, 10);
  return `tenants/${tenantId}/${day}/${callSessionId}.${ext}`;
}

export function storageUrlFromKey(objectKey) {
  return `minio://${BUCKET}/${objectKey}`;
}

export function objectKeyFromStorageUrl(storageUrl) {
  const raw = String(storageUrl || '');
  if (raw.startsWith(`minio://${BUCKET}/`)) return raw.slice(`minio://${BUCKET}/`.length);
  if (raw.startsWith(`${BUCKET}/`)) return raw.slice(BUCKET.length + 1);
  return raw;
}

export async function putObject(key, body, contentType = 'audio/wav') {
  if (process.env.MINIO_STUB === '1') {
    return { bucket: BUCKET, storageKey: `${BUCKET}/${key}`, objectKey: key };
  }
  const minio = getMinioClient();
  if (!minio) throw new Error('MinIO client not configured');
  await minio.putObject(BUCKET, key, body, body.length, { 'Content-Type': contentType });
  return { bucket: BUCKET, storageKey: `${BUCKET}/${key}`, objectKey: key };
}

export async function presignedGetUrl(objectKey, expirySec = 3600) {
  if (process.env.MINIO_STUB === '1') return null;
  const minio = getMinioClient();
  if (!minio) return null;
  let url = await minio.presignedGetObject(BUCKET, objectKey, expirySec);
  if (PUBLIC_ENDPOINT !== ENDPOINT) {
    const pub = parseEndpoint(PUBLIC_ENDPOINT);
    const internal = parseEndpoint(ENDPOINT);
    const signed = new URL(url);
    signed.protocol = pub.useSSL ? 'https:' : 'http:';
    signed.hostname = pub.endPoint;
    signed.port = pub.port === (pub.useSSL ? 443 : 80) ? '' : String(pub.port);
    url = signed.toString();
  }
  return url;
}

export async function getObjectStream(objectKey) {
  if (process.env.MINIO_STUB === '1') return null;
  const minio = getMinioClient();
  if (!minio) return null;
  return minio.getObject(BUCKET, objectKey);
}

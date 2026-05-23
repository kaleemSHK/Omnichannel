#!/usr/bin/env node
/** Seed IVR + routing for a Chatwoot account id (tenant). */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const tenantId = process.env.SEED_TENANT || '1';

function loadEnv() {
  const path = join(root, '.env');
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

const env = loadEnv();
const routingToken = process.env.ROUTING_TOKEN || env.ROUTING_TOKEN || 'routing-api-token';
const ivrToken = process.env.IVR_TOKEN || env.IVR_TOKEN || 'ivr-api-token';
const base = { Authorization: `Bearer ${routingToken}`, 'X-Blinkone-Tenant-Id': tenantId, 'Content-Type': 'application/json' };

async function req(url, opts = {}) {
  const res = await fetch(url, { ...opts, headers: { ...base, ...opts.headers } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok && res.status !== 409) throw new Error(`${url} ${res.status} ${JSON.stringify(json)}`);
  return json.data ?? json;
}

const apiBase = (process.env.API_BASE || 'http://127.0.0.1/api').replace(/\/$/, '');
const routing = process.env.ROUTING_URL || `${apiBase}/routing`;
const ivr = process.env.IVR_URL || `${apiBase}/ivr`;

for (const q of [
  { queueKey: 'sales', name: 'Sales', skills: [{ skill: 'sales', required: true }] },
  { queueKey: 'support', name: 'Support', skills: [{ skill: 'support', required: true }] },
]) {
  try {
    await req(`${routing}/v1/queues`, { method: 'POST', body: JSON.stringify(q) });
    console.log('queue', q.queueKey);
  } catch (e) {
    if (!String(e.message).includes('409') && !String(e.message).includes('CONFLICT')) console.warn(e.message);
  }
}

try {
  await req(`${ivr}/v1/flows`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ivrToken}`, 'X-Blinkone-Tenant-Id': tenantId, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Demo welcome',
      isDefault: true,
      graph: {
        entry: 'welcome',
        nodes: [
          { id: 'welcome', type: 'play', media: 'sound:hello-world', next: 'menu' },
          { id: 'menu', type: 'play', media: 'sound:please-try-again', collectDigits: true, next: 'hangup' },
          { id: 'sales', type: 'enqueue', queue: 'sales', digit: '1' },
          { id: 'hangup', type: 'hangup' },
        ],
      },
    }),
  });
  console.log('ivr flow Demo welcome');
} catch (e) {
  console.warn('ivr', e.message);
}

console.log('sidecar seed done for tenant', tenantId);

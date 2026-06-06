#!/usr/bin/env node
/**
 * Seed Main Support IVR flow + queues for tenant (default: Chatwoot account 1).
 *
 * Usage:
 *   node scripts/seed-main-support-ivr.mjs
 *   SEED_TENANT=1 API_BASE=https://app.blinksone.com/api node scripts/seed-main-support-ivr.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
const apiBase = (process.env.API_BASE || 'http://127.0.0.1/api').replace(/\/$/, '');
const routing = process.env.ROUTING_URL || `${apiBase}/routing`;
const ivr = process.env.IVR_URL || `${apiBase}/ivr`;

const { MAIN_SUPPORT_IVR_GRAPH } = await import(
  pathToFileURL(join(root, 'services/ivr/lib/main-support-flow-graph.js')).href
);

async function req(url, token, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Blinkone-Tenant-Id': tenantId,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok && res.status !== 409) {
    throw new Error(`${url} ${res.status} ${JSON.stringify(json)}`);
  }
  return json.data ?? json;
}

const queues = [
  { queueKey: 'sales', name: 'Sales', skills: [{ skill: 'sales', required: true }] },
  { queueKey: 'support', name: 'Support', skills: [{ skill: 'support', required: true }] },
  { queueKey: 'default', name: 'General Support', skills: [] },
];

for (const q of queues) {
  try {
    await req(`${routing}/v1/queues`, routingToken, { method: 'POST', body: JSON.stringify(q) });
    console.log('queue', q.queueKey);
  } catch (e) {
    if (!String(e.message).includes('409') && !String(e.message).includes('CONFLICT')) {
      console.warn('queue', q.queueKey, e.message);
    }
  }
}

const flowName = 'Main Support Flow';
let flowId = null;

try {
  const list = await req(`${ivr}/v1/flows`, ivrToken);
  const existing = (Array.isArray(list) ? list : []).find((f) => f.name === flowName);
  if (existing?.id) {
    flowId = existing.id;
    console.log('flow exists', flowId);
    await req(`${ivr}/v1/flows/${flowId}/versions`, ivrToken, {
      method: 'POST',
      body: JSON.stringify({ graph: MAIN_SUPPORT_IVR_GRAPH, comment: 'Seed main support IVR' }),
    });
    console.log('published new version');
  } else {
    const created = await req(`${ivr}/v1/flows`, ivrToken, {
      method: 'POST',
      body: JSON.stringify({
        name: flowName,
        description: 'Language menu → Sales / Tech / Billing / Agent (support queue)',
        graph: MAIN_SUPPORT_IVR_GRAPH,
      }),
    });
    flowId = created.id;
    console.log('created flow', flowId);
  }
} catch (e) {
  console.error('ivr flow', e.message);
  process.exit(1);
}

if (flowId) {
  try {
    await req(`${ivr}/v1/flows/${flowId}`, ivrToken, {
      method: 'PATCH',
      body: JSON.stringify({ isDefault: true }),
    });
    console.log('set default flow for tenant', tenantId);
  } catch (e) {
    console.warn('patch default', e.message);
  }
}

console.log('Main Support IVR seed complete for tenant', tenantId);

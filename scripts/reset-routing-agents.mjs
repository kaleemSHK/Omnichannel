#!/usr/bin/env node
/** Reset routing agent Redis state + ensure DB rows (tenant 1). Run on server: node scripts/reset-routing-agents.mjs */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const tenantId = process.env.SEED_TENANT || '1';
const agentIds = (process.env.AGENT_IDS || '1,2,3').split(',').map((s) => s.trim());

function loadEnv() {
  const path = join(__dirname, '..', '.env');
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

const env = loadEnv();
const token = process.env.ROUTING_TOKEN || env.ROUTING_TOKEN || 'blinkone-routing-token';
const base = (process.env.ROUTING_URL || 'http://127.0.0.1:8798').replace(/\/$/, '');
const headers = {
  Authorization: `Bearer ${token}`,
  'X-Blinkone-Tenant-Id': tenantId,
  'Content-Type': 'application/json',
};

async function req(path, opts = {}) {
  const res = await fetch(`${base}${path}`, { ...opts, headers: { ...headers, ...opts.headers } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} ${res.status} ${JSON.stringify(json)}`);
  return json.data ?? json;
}

for (const agentId of agentIds) {
  try {
    await req(`/v1/agents/${agentId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        state: 'available',
        skills: ['support'],
        queueKeys: ['support', 'default'],
        chatwootUserId: agentId,
      }),
    });
    console.log('agent', agentId, '→ available');
  } catch (e) {
    try {
      await req(`/v1/agents/${agentId}/state`, {
        method: 'POST',
        body: JSON.stringify({
          status: 'available',
          skills: ['support'],
          queueKeys: ['support', 'default'],
        }),
      });
      console.log('agent', agentId, '→ available (state POST)');
    } catch (e2) {
      console.error('agent', agentId, e2.message);
    }
  }
}

const dash = await req('/v1/dashboards/realtime');
console.log(
  'dashboard:',
  dash.agents?.length ?? 0,
  'agents,',
  dash.totalWaiting ?? 0,
  'waiting,',
  dash.agents?.filter((a) => a.currentCallId).length ?? 0,
  'active',
);

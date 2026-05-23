#!/usr/bin/env node
/**
 * Full client demo seed: Chatwoot conversations + tenant features + billing + SLA + IVR/routing.
 * Usage: node scripts/seed-client-demo.mjs [--tenant-id=1] [--skip-chatwoot]
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { PLAN_FEATURE_TEMPLATES } from '../services/_shared/lib/plan-features.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

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
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const tenantId = String(args['tenant-id'] || env.SEED_TENANT || '1');
const planId = String(args.plan || 'business');
const baseUrl = (env.FRONTEND_URL || 'http://127.0.0.1').replace(/\/$/, '');
const apiBase = `${baseUrl}/api`;
const skipChatwoot = !!args['skip-chatwoot'];

const tokens = {
  platform: env.PLATFORM_TOKEN || env.TENANT_TOKEN || 'dev-platform-token',
  billing: env.BILLING_TOKEN || 'dev-billing-token',
  sla: env.SLA_TOKEN || 'dev-sla-token',
  escalation: env.ESCALATION_TOKEN || 'dev-escalation-token',
  routing: env.ROUTING_TOKEN || 'dev-routing-token',
  ivr: env.IVR_TOKEN || 'dev-ivr-token',
};

function hdr(token, extra = {}) {
  return {
    Authorization: `Bearer ${token}`,
    'X-Blinkone-Tenant-Id': tenantId,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function api(service, path, { method = 'GET', body, tokenKey = 'platform' } = {}) {
  const url = `${apiBase}/${service}${path}`;
  const res = await fetch(url, {
    method,
    headers: hdr(tokens[tokenKey], tokenKey === 'platform' ? { 'X-Blinkone-Platform-Role': 'platform_admin' } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok && res.status !== 409) {
    throw new Error(`${method} ${url} → ${res.status} ${JSON.stringify(json.error || json)}`);
  }
  return json.data ?? json;
}

function execPsqlFile(relPath, label) {
  const local = join(root, relPath);
  if (!existsSync(local)) {
    console.warn(`${label}: missing ${relPath}`);
    return false;
  }
  const remote = `/tmp/${relPath.replace(/[/\\]/g, '_')}`;
  const cp = spawnSync('docker', ['compose', 'cp', local, `postgres_app:${remote}`], {
    cwd: root,
    stdio: 'pipe',
    encoding: 'utf8',
  });
  if (cp.status !== 0) {
    console.warn(`${label}:`, (cp.stderr || cp.stdout || '').trim() || 'docker cp failed');
    return false;
  }
  const r = spawnSync(
    'docker',
    ['compose', 'exec', '-T', 'postgres_app', 'psql', '-U', 'app', '-d', 'blinkone_app', '-v', 'ON_ERROR_STOP=1', '-f', remote],
    { cwd: root, stdio: 'pipe', encoding: 'utf8' },
  );
  if (r.status !== 0) {
    console.warn(`${label}:`, (r.stderr || r.stdout || '').trim() || 'psql failed');
    return false;
  }
  console.log(`✓ ${label}`);
  return true;
}

async function ensureTenantRow() {
  const features = PLAN_FEATURE_TEMPLATES[planId] || PLAN_FEATURE_TEMPLATES.business;
  if (!execPsqlFile('scripts/sql/seed-demo-tenant.sql', 'tenant row + features (SQL)')) {
    try {
      await api('tenant', `/v1/tenants/${tenantId}/features/apply`, {
        method: 'POST',
        tokenKey: 'platform',
        body: { features, billingPlanId: planId },
      });
      console.log('✓ tenant features (API, plan:', planId, ')');
    } catch (e) {
      console.warn('tenant seed failed:', e.message);
    }
  }
}

async function seedBilling() {
  try {
    await api('billing', `/v1/tenants/${tenantId}/subscription`, {
      method: 'POST',
      tokenKey: 'billing',
      body: { planId, trialDays: 0 },
    });
    console.log('✓ billing subscription:', planId);
  } catch (e) {
    if (String(e.message).includes('409') || String(e.message).includes('already')) {
      console.log('✓ billing subscription already active');
    } else {
      console.warn('billing:', e.message);
    }
  }
}

function seedChatwootRake() {
  console.log('\n── Chatwoot demo (conversations, contacts, agent) ──');
  const r = spawnSync('docker', ['compose', 'exec', '-T', 'chatwoot', 'bundle', 'exec', 'rake', 'blinkone:demo:seed'], {
    cwd: root,
    stdio: 'inherit',
  });
  if (r.status !== 0) {
    console.warn('Chatwoot rake failed — copy seeder and retry:');
    console.warn('  docker compose cp lib/blink_one/demo_seeder.rb chatwoot:/app/lib/blink_one/');
    console.warn('  docker compose exec chatwoot bundle exec rake blinkone:demo:seed');
  }
}

function seedCallsDb() {
  console.log('\n── Demo calls (Postgres) ──');
  execPsqlFile('scripts/sql/seed-demo-calls.sql', 'call sessions (mock inbox)');
}

function seedSlaDb() {
  console.log('\n── SLA + escalation (Postgres) ──');
  if (!execPsqlFile('scripts/sql/seed-demo-sla.sql', 'SLA policies + escalation rules')) {
    process.env.SEED_TENANT = tenantId;
    process.env.BLINKONE_DATABASE_URL =
      process.env.BLINKONE_DATABASE_URL ||
      `postgresql://app:${env.APP_DB_PASSWORD || 'apppass'}@127.0.0.1:5433/blinkone_app`;
    const r = spawnSync('node', ['scripts/seed-sla.mjs'], { cwd: root, stdio: 'inherit' });
    if (r.status !== 0) console.warn('seed-sla.mjs failed (set BLINKONE_DATABASE_URL or use Docker stack)');
  }
}

async function seedSidecarsApi() {
  console.log('\n── IVR + routing (API) ──');
  process.env.SEED_TENANT = tenantId;
  const r = spawnSync('node', ['scripts/seed-demo-sidecars.mjs'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, SEED_TENANT: tenantId, API_BASE: apiBase },
  });
  if (r.status !== 0) await seedSidecarsInline();
}

async function seedSidecarsInline() {
  for (const q of [
    { queueKey: 'sales', name: 'Sales — Demo', skills: [{ skill: 'sales', required: true }] },
    { queueKey: 'support', name: 'Support — Demo', skills: [{ skill: 'support', required: true }] },
  ]) {
    try {
      await api('routing', '/v1/queues', { method: 'POST', body: q, tokenKey: 'routing' });
      console.log('  queue', q.queueKey);
    } catch (e) {
      if (!String(e.message).includes('409')) console.warn('  queue', e.message);
    }
  }
  try {
    await api('ivr', '/v1/flows', {
      method: 'POST',
      tokenKey: 'ivr',
      body: {
        name: 'Demo welcome (Arabic/English)',
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
      },
    });
    console.log('  ivr flow');
  } catch (e) {
    if (!String(e.message).includes('409')) console.warn('  ivr', e.message);
  }
}

function printDemoCard() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║           BlinkOne — CLIENT DEMO (LABBIK / Oman)             ║
╠══════════════════════════════════════════════════════════════╣
║  URL:      ${baseUrl}/app/login
║  Agent:    demo.agent@blinkone.ai
║  Password: DemoAgent1!
║  Account:  ${tenantId} (Chatwoot account id = tenant id)
║  Plan:     ${planId} (SLA, escalation, telephony, agent assist)
╠══════════════════════════════════════════════════════════════╣
║  Demo story (8 chats):
║  • Fiber upgrade, bill inquiry, Muscat outage (urgent)
║  • Business SIP lines, roaming, payment issue
║  • Arabic IVR question (snoozed)
╠══════════════════════════════════════════════════════════════╣
║  Settings → BlinkOne:
║  • SLA policies (Gold / Silver / Bronze)
║  • Escalation rules
║  • IVR flows, Routing queues
║  • Platform billing (if platform_admin)
╚══════════════════════════════════════════════════════════════╝
`);
}

async function main() {
  console.log('BlinkOne client demo seed — tenant', tenantId);
  if (!skipChatwoot) seedChatwootRake();
  await ensureTenantRow();
  await seedBilling();
  seedCallsDb();
  seedSlaDb();
  await seedSidecarsApi();
  printDemoCard();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

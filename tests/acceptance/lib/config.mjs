import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');

export function loadEnv() {
  const path = join(root, '.env');
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

const env = { ...loadEnv(), ...process.env };

export const cfg = {
  frontendUrl: (env.FRONTEND_URL || 'http://127.0.0.1').replace(/\/$/, ''),
  gatewayUrl: (env.GATEWAY_URL || 'http://127.0.0.1:8787').replace(/\/$/, ''),
  databaseUrl: env.BLINKONE_DATABASE_URL || '',
  routingUrl: (env.ROUTING_URL || 'http://127.0.0.1:8798').replace(/\/$/, ''),
  aiUrl: (env.AI_URL || 'http://127.0.0.1:8793').replace(/\/$/, ''),
  tenantUrl: (env.TENANT_URL || 'http://127.0.0.1:8802').replace(/\/$/, ''),
  integrationUrl: (env.INTEGRATION_URL || 'http://127.0.0.1:8800').replace(/\/$/, ''),
  minioEndpoint: env.MINIO_ENDPOINT || '127.0.0.1:9000',
  callsToken: env.CALLS_TOKEN || 'calls-api-token',
  routingToken: env.ROUTING_TOKEN || 'routing-api-token',
  host: env.ACCEPTANCE_HOST || '127.0.0.1',
  tokens: {
    routing: env.ROUTING_TOKEN || 'routing-api-token',
    calls: env.CALLS_TOKEN || 'calls-api-token',
    ai: env.AI_TOKEN || 'ai-api-token',
    tenant: env.TENANT_TOKEN || env.PLATFORM_TOKEN || 'tenant-api-token',
    integration: env.INTEGRATION_TOKEN || 'integration-api-token',
  },
  runAcceptance: env.RUN_ACCEPTANCE === '1',
  artifactsDir: join(root, 'tests/acceptance/artifacts'),
};

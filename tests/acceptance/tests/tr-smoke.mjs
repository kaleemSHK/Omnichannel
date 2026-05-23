import { cfg } from '../lib/config.mjs';
import { health } from '../lib/client.mjs';

const services = [
  ['Gateway', () => cfg.gatewayUrl],
  ['Routing', () => cfg.routingUrl],
  ['AI', () => cfg.aiUrl],
  ['Tenant', () => cfg.tenantUrl],
  ['Integration', () => cfg.integrationUrl],
];

export async function run() {
  const start = Date.now();
  const down = [];
  for (const [name, urlFn] of services) {
    if (!(await health(urlFn()))) down.push(name);
  }
  if (down.length === services.length) {
    return { status: 'SKIP', detail: 'No sidecars reachable — start docker compose' };
  }
  if (down.length) {
    return { status: 'SKIP', detail: `Partial stack: down ${down.join(', ')}` };
  }
  return { status: 'PASS', detail: 'Core sidecars healthy', durationMs: Date.now() - start };
}

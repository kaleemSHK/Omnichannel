import { createLogger } from '../lib/logger.js';
import * as queueRepo from './queue-repo.js';
import { processQueue } from './route-request.js';
import { processWaitTimeOverflow } from './overflow.js';
import { processLongWaitEscalations } from './escalation-events.js';
import { getPool, dbEnabled } from './db.js';

const log = createLogger('routing-worker');

let timer;

async function listQueueTenantIds() {
  const extra = (process.env.ROUTING_QUEUE_TENANTS || process.env.CHATWOOT_DEFAULT_ACCOUNT || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const base = new Set([process.env.ROUTING_DEFAULT_TENANT || 'default', ...extra]);
  if (!dbEnabled()) return [...base];
  try {
    const { rows } = await getPool().query('SELECT DISTINCT tenant_id FROM routing_queues');
    for (const r of rows) {
      if (r.tenant_id) base.add(String(r.tenant_id));
    }
  } catch (e) {
    log.warn({ err: e.message }, 'list queue tenants');
  }
  return [...base];
}

export function startQueueWorker(intervalMs = 5000) {
  if (process.env.ROUTING_QUEUE_WORKER === '0') return;
  if (timer) return;

  timer = setInterval(async () => {
    try {
      const tenants = await listQueueTenantIds();
      for (const tenantId of tenants) {
        const queues = await queueRepo.listQueues(tenantId);
        for (const q of queues) {
          try {
            await processWaitTimeOverflow(tenantId, q);
            await processLongWaitEscalations(tenantId, q);
            await processQueue(tenantId, q.queueKey);
          } catch (e) {
            if (e.code !== 'NO_AGENT' && e.code !== 'NO_CALL') {
              log.warn({ tenantId, queue: q.queueKey, err: e.message }, 'queue tick');
            }
          }
        }
      }
    } catch (e) {
      log.warn({ err: e.message }, 'queue worker');
    }
  }, intervalMs);

  log.info({ intervalMs }, 'queue worker started (multi-tenant)');
}

export function stopQueueWorker() {
  if (timer) clearInterval(timer);
  timer = null;
}

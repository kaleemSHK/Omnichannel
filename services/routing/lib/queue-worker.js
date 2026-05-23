import { createLogger } from '../lib/logger.js';
import * as queueRepo from './queue-repo.js';
import { processQueue } from './route-request.js';
import { processWaitTimeOverflow } from './overflow.js';

const log = createLogger('routing-worker');

let timer;

export function startQueueWorker(intervalMs = 5000) {
  if (process.env.ROUTING_QUEUE_WORKER === '0') return;
  if (timer) return;
  const tenantId = process.env.ROUTING_DEFAULT_TENANT || 'default';

  timer = setInterval(async () => {
    try {
      const queues = await queueRepo.listQueues(tenantId);
      for (const q of queues) {
        try {
          await processWaitTimeOverflow(tenantId, q);
          await processQueue(tenantId, q.queueKey);
        } catch (e) {
          if (e.code !== 'NO_AGENT' && e.code !== 'NO_CALL') {
            log.warn({ queue: q.queueKey, err: e.message }, 'queue tick');
          }
        }
      }
    } catch (e) {
      log.warn({ err: e.message }, 'queue worker');
    }
  }, intervalMs);

  log.info({ intervalMs, tenantId }, 'queue worker started');
}

export function stopQueueWorker() {
  if (timer) clearInterval(timer);
  timer = null;
}

import { processDueDeliveries } from './integration-repo.js';

export function startIntegrationWorkers(log = console) {
  if (process.env.INTEGRATION_WORKERS === '0') return;
  setInterval(() => {
    processDueDeliveries(log).catch((e) => log.warn?.({ err: e.message }, 'webhook worker'));
  }, 30_000);
  processDueDeliveries(log).catch(() => {});
  log.info?.('integration workers started');
}

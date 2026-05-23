import { rollupDaily, runDunning } from './billing-repo.js';

export function startBillingWorkers(log = console) {
  if (process.env.BILLING_WORKERS === '0') return;

  setInterval(() => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    rollupDaily(yesterday).catch((e) => log.warn?.({ err: e.message }, 'rollup failed'));
  }, 3600_000);

  setInterval(() => {
    runDunning(log).catch((e) => log.warn?.({ err: e.message }, 'dunning failed'));
  }, 6 * 3600_000);

  runDunning(log).catch(() => {});
  log.info?.('billing workers started');
}

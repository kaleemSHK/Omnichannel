import { getPool } from './db.js';

const ACME_STUB = process.env.ACME_STUB !== '0';

/**
 * Process pending domain SSL (ACME stub or lego hook).
 * Production: shell out to acme.sh / lego with verification_token HTTP-01.
 */
export async function processPendingAcme(log = console) {
  const p = getPool();
  const { rows } = await p.query(
    `SELECT id, tenant_id, domain, verification_token, ssl_status
     FROM tenant_domains
     WHERE ssl_status IN ('pending', 'verifying')
     ORDER BY created_at
     LIMIT 20`,
  );

  for (const row of rows) {
    try {
      if (ACME_STUB) {
        await p.query(
          `UPDATE tenant_domains SET ssl_status = 'issued' WHERE id = $1`,
          [row.id],
        );
        log.info?.({ domain: row.domain, tenantId: row.tenant_id }, 'acme stub issued');
        continue;
      }

      const verified = await verifyDnsChallenge(row);
      await p.query(
        `UPDATE tenant_domains SET ssl_status = $2 WHERE id = $1`,
        [row.id, verified ? 'issued' : 'verifying'],
      );
    } catch (e) {
      log.warn?.({ domain: row.domain, err: e.message }, 'acme failed');
      await p.query(
        `UPDATE tenant_domains SET ssl_status = 'failed' WHERE id = $1`,
        [row.id],
      );
    }
  }
}

async function verifyDnsChallenge(_row) {
  // Hook: lego --dns or HTTP-01 against ingress
  return false;
}

export function startAcmeWorker(intervalMs = 120_000, log = console) {
  if (process.env.ACME_WORKER === '0') return;
  setInterval(() => {
    processPendingAcme(log).catch((e) => log.warn?.({ err: e.message }, 'acme worker'));
  }, intervalMs);
  processPendingAcme(log).catch(() => {});
}

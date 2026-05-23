#!/usr/bin/env node
/** One-time import: tickets/data/store.json → Postgres */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const url = process.env.BLINKONE_DATABASE_URL;
if (!url) {
  console.error('BLINKONE_DATABASE_URL required');
  process.exit(1);
}

const dataDir = process.env.DATA_DIR || join(dirname(fileURLToPath(import.meta.url)), '../../services/tickets/data');
const file = join(dataDir, 'store.json');
if (!existsSync(file)) {
  console.log('No store.json — skip import');
  process.exit(0);
}

const s = JSON.parse(readFileSync(file, 'utf8'));
const pool = new pg.Pool({ connectionString: url });

async function run() {
  for (const t of s.tickets ?? []) {
    const { rows } = await pool.query(
      `INSERT INTO tickets (
         id, tenant_id, title, status, priority, channel, customer_name, customer_email,
         department, chatwoot_account_id, chatwoot_conversation_id, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (id) DO NOTHING
       RETURNING id`,
      [
        t.id,
        t.tenantId ?? String(t.chatwootAccountId),
        t.title,
        t.status,
        t.priority,
        t.channel,
        t.customerName,
        t.customerEmail,
        t.department,
        t.chatwootAccountId,
        t.chatwootConversationId,
        t.createdAt,
        t.updatedAt,
      ],
    );
    if (!rows.length) continue;
    for (const e of (s.events ?? []).filter((x) => x.ticketId === t.id)) {
      await pool.query(
        'INSERT INTO ticket_events (ticket_id, at, type, message, actor) VALUES ($1,$2,$3,$4,$5)',
        [t.id, e.at, e.type, e.message, e.actor],
      );
    }
    for (const f of (s.fields ?? []).filter((x) => x.ticketId === t.id)) {
      await pool.query(
        'INSERT INTO ticket_fields (ticket_id, key, value) VALUES ($1,$2,$3) ON CONFLICT (ticket_id, key) DO NOTHING',
        [t.id, f.key, f.value],
      );
    }
  }
  const maxId = Math.max(0, ...(s.tickets ?? []).map((t) => t.id));
  if (maxId > 0) {
    await pool.query(`SELECT setval(pg_get_serial_sequence('tickets', 'id'), $1)`, [maxId]);
  }
  console.log(`Imported ${(s.tickets ?? []).length} tickets`);
  await pool.end();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

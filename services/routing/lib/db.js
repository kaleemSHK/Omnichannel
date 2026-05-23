import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'db');

/** @type {pg.Pool | null} */
let pool = null;

export function dbEnabled() {
  return Boolean((process.env.BLINKONE_DATABASE_URL || '').trim());
}

export function getPool() {
  if (!dbEnabled()) return null;
  if (!pool) {
    pool = new pg.Pool({ connectionString: process.env.BLINKONE_DATABASE_URL });
  }
  return pool;
}

export async function runMigrations(log = console) {
  const p = getPool();
  if (!p) return false;

  await p.query(`
    CREATE TABLE IF NOT EXISTS routing_schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const { rows } = await p.query('SELECT 1 FROM routing_schema_migrations WHERE name = $1', [file]);
    if (rows.length) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    const client = await p.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO routing_schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      log.info?.({ file }, 'applied routing migration') ?? log.log(`applied migration ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
  return true;
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

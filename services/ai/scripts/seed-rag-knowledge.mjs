#!/usr/bin/env node
/**
 * Seed real RAG collections + indexed documents for a tenant (default: 1).
 * Run: docker compose exec ai node scripts/seed-rag-knowledge.mjs
 * Force re-index: FORCE=1 docker compose exec ai node scripts/seed-rag-knowledge.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool, runMigrations } from '../lib/db.js';
import * as rag from '../lib/rag/service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_DIR = join(__dirname, '..', 'seed');
const TENANT_ID = String(process.env.TENANT_ID || '1');
const FORCE = process.env.FORCE === '1';

const CATALOG = [
  {
    name: 'BlinkOne Product FAQ',
    language: 'en',
    documents: [
      { file: 'product-faq.md', source_type: 'markdown' },
    ],
  },
  {
    name: 'Billing & Payments',
    language: 'en',
    documents: [
      { file: 'billing-policies.md', source_type: 'markdown' },
    ],
  },
  {
    name: 'Technical Support',
    language: 'en',
    documents: [
      { file: 'troubleshooting-router.md', source_type: 'markdown' },
    ],
  },
];

async function ensureCollection(name, language) {
  const all = await rag.listCollections(TENANT_ID);
  let col = all.find(c => c.name === name);
  if (!col) {
    const created = await rag.createCollection(TENANT_ID, { name, language });
    col = { id: created.id ?? created.collection_id, name: created.name, language };
    console.log(`  + collection: ${name} (${col.id})`);
  } else {
    console.log(`  = collection exists: ${name} (${col.id})`);
  }
  return col;
}

async function seedDocument(collectionId, { file, source_type }) {
  const path = join(SEED_DIR, file);
  const content = readFileSync(path, 'utf8');
  const { rows: existing } = await getPool().query(
    `SELECT id FROM rag_documents WHERE tenant_id = $1 AND collection_id = $2 AND source_ref = $3`,
    [TENANT_ID, collectionId, file],
  );
  if (existing.length && !FORCE) {
    console.log(`    skip document (indexed): ${file}`);
    return;
  }
  if (existing.length && FORCE) {
    console.log(`    re-index: ${file}`);
    await getPool().query(
      `DELETE FROM rag_documents WHERE tenant_id = $1 AND collection_id = $2 AND source_ref = $3`,
      [TENANT_ID, collectionId, file],
    );
  } else {
    console.log(`    index: ${file}`);
  }
  const result = await rag.indexDocument(TENANT_ID, {
    collection_id: collectionId,
    source_type,
    source_ref: file,
    content,
  });
  console.log(`      chunks: ${result.chunk_count}`);
}

async function main() {
  if (!process.env.BLINKONE_DATABASE_URL) {
    console.error('BLINKONE_DATABASE_URL is required');
    process.exit(1);
  }
  await runMigrations(console);
  console.log(`Seeding RAG knowledge for tenant ${TENANT_ID}…`);
  for (const entry of CATALOG) {
    const col = await ensureCollection(entry.name, entry.language);
    const collectionId = col.id;
    for (const doc of entry.documents) {
      await seedDocument(collectionId, doc);
    }
  }
  const all = await rag.listCollections(TENANT_ID);
  console.log('\nCollections:');
  for (const c of all) {
    console.log(`  - ${c.name}: ${c.doc_count} document(s)`);
  }
  console.log('\nDone. Test in AI → Query tester with: "Fiber 500 upgrade" or "router reset".');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});

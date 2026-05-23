import { randomUUID } from 'node:crypto';
import { getPool } from '../db.js';
import { chatCompletions, resolveAdapter } from '../llm/gateway.js';

const CHUNK_CHARS = 1800;
const OVERLAP = 200;

function chunkText(text) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + CHUNK_CHARS));
    i += CHUNK_CHARS - OVERLAP;
  }
  return chunks.filter((c) => c.trim().length > 20);
}

export async function listCollections(tenantId) {
  const { rows } = await getPool().query(
    `SELECT id, name, language, created_at FROM rag_collections WHERE tenant_id = $1 ORDER BY name`,
    [tenantId],
  );
  return rows;
}

export async function createCollection(tenantId, { name, language }) {
  const { rows } = await getPool().query(
    `INSERT INTO rag_collections (tenant_id, name, language) VALUES ($1,$2,$3) RETURNING *`,
    [tenantId, name, language || 'ar'],
  );
  return { collection_id: rows[0].id, ...rows[0] };
}

export async function indexDocument(tenantId, { collection_id, source_type, source_ref, content }) {
  const text = content || source_ref;
  const { rows: docRows } = await getPool().query(
    `INSERT INTO rag_documents (tenant_id, collection_id, source_type, source_ref, status)
     VALUES ($1,$2,$3,$4,'indexing') RETURNING *`,
    [tenantId, collection_id, source_type, source_ref],
  );
  const docId = docRows[0].id;
  const chunks = chunkText(text);
  const adapter = await resolveAdapter(tenantId);
  const embeddings = await adapter.embed(chunks);

  for (let i = 0; i < chunks.length; i++) {
    const emb = embeddings[i];
    const vec = `[${emb.join(',')}]`;
    await getPool().query(
      `INSERT INTO rag_chunks (tenant_id, document_id, content, token_count, chunk_index, embedding)
       VALUES ($1,$2,$3,$4,$5,$6::vector)`,
      [tenantId, docId, chunks[i], Math.ceil(chunks[i].length / 4), i, vec],
    );
  }

  await getPool().query(
    `UPDATE rag_documents SET status = 'indexed', chunk_count = $2, indexed_at = now() WHERE id = $1`,
    [docId, chunks.length],
  );
  return { index_job_id: docId, chunk_count: chunks.length };
}

export async function queryRag(tenantId, { collection_id, query, top_k = 5, min_score = 0.72 }) {
  const adapter = await resolveAdapter(tenantId);
  const [qEmb] = await adapter.embed([query]);
  const vec = `[${qEmb.join(',')}]`;

  const { rows } = await getPool().query(
    `SELECT c.id AS chunk_id, c.content, c.document_id, 1 - (c.embedding <=> $1::vector) AS score
     FROM rag_chunks c
     JOIN rag_documents d ON d.id = c.document_id
     WHERE c.tenant_id = $2 AND d.collection_id = $3 AND c.embedding IS NOT NULL
     ORDER BY c.embedding <=> $1::vector
     LIMIT $4`,
    [vec, tenantId, collection_id, top_k],
  );

  return {
    chunks: rows
      .filter((r) => Number(r.score) >= min_score)
      .map((r) => ({
        chunk_id: r.chunk_id,
        content: r.content,
        score: Number(r.score),
        document_id: r.document_id,
        metadata: {},
      })),
  };
}

-- pgvector for RAG embeddings (1536 = text-embedding-3-small)
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE rag_chunks ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- ivfflat suitable up to ~1M vectors per tenant; use hnsw above that
CREATE INDEX IF NOT EXISTS rag_chunks_embedding_idx
  ON rag_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

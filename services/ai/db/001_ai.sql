-- BlinkOne AI service (Prompt 7)
CREATE TABLE IF NOT EXISTS ai_provider_configs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         TEXT NOT NULL,
  provider          TEXT NOT NULL DEFAULT 'openai',
  model_default     TEXT NOT NULL DEFAULT 'gpt-4o',
  model_fast        TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  base_url          TEXT NOT NULL DEFAULT 'https://api.openai.com/v1',
  encrypted_api_key TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider)
);

CREATE TABLE IF NOT EXISTS ai_usage_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       TEXT NOT NULL,
  source_service  TEXT NOT NULL DEFAULT 'ai',
  source_event_id TEXT NOT NULL UNIQUE,
  dimension       TEXT NOT NULL,
  quantity        INTEGER NOT NULL DEFAULT 0,
  cost_cents      INTEGER NOT NULL DEFAULT 0,
  model_or_voice  TEXT,
  latency_ms      INTEGER,
  success         BOOLEAN NOT NULL DEFAULT true,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_tenant ON ai_usage_events (tenant_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS stt_jobs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          TEXT NOT NULL,
  audio_minio_key    TEXT NOT NULL,
  language_hint      TEXT NOT NULL DEFAULT 'ar-OM',
  diarize            BOOLEAN NOT NULL DEFAULT true,
  context_phrases    JSONB NOT NULL DEFAULT '[]',
  status             TEXT NOT NULL DEFAULT 'queued',
  transcript         TEXT,
  words              JSONB,
  detected_language  TEXT,
  error_message      TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_stt_jobs_status ON stt_jobs (tenant_id, status);

CREATE TABLE IF NOT EXISTS rag_collections (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  TEXT NOT NULL,
  name       TEXT NOT NULL,
  language   TEXT NOT NULL DEFAULT 'ar',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS rag_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     TEXT NOT NULL,
  collection_id UUID NOT NULL REFERENCES rag_collections (id) ON DELETE CASCADE,
  source_type   TEXT NOT NULL,
  source_ref    TEXT NOT NULL,
  metadata      JSONB NOT NULL DEFAULT '{}',
  chunk_count   INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'pending',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  indexed_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_rag_docs ON rag_documents (tenant_id, collection_id);

CREATE TABLE IF NOT EXISTS rag_chunks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   TEXT NOT NULL,
  document_id UUID NOT NULL REFERENCES rag_documents (id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  token_count INTEGER NOT NULL DEFAULT 0,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_doc ON rag_chunks (tenant_id, document_id);

CREATE TABLE IF NOT EXISTS voice_sessions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             TEXT NOT NULL,
  call_id               TEXT NOT NULL UNIQUE,
  inbox_id              TEXT NOT NULL,
  collection_id         UUID REFERENCES rag_collections (id) ON DELETE SET NULL,
  language              TEXT NOT NULL DEFAULT 'ar-OM',
  max_misunderstandings INTEGER NOT NULL DEFAULT 3,
  state                 TEXT NOT NULL DEFAULT 'greeting',
  misunderstanding_count INTEGER NOT NULL DEFAULT 0,
  transfer_to_queue_id  TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at              TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_voice_sessions ON voice_sessions (tenant_id, call_id);

CREATE TABLE IF NOT EXISTS voice_turns (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id         UUID NOT NULL REFERENCES voice_sessions (id) ON DELETE CASCADE,
  turn_index         INTEGER NOT NULL,
  audio_minio_key    TEXT NOT NULL,
  transcript         TEXT,
  intent             TEXT,
  response_text      TEXT,
  response_audio_key TEXT,
  barge_in           BOOLEAN NOT NULL DEFAULT false,
  stt_latency_ms     INTEGER,
  llm_latency_ms     INTEGER,
  tts_latency_ms     INTEGER,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_voice_turns ON voice_turns (session_id, turn_index);

CREATE TABLE IF NOT EXISTS message_signals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       TEXT NOT NULL,
  conversation_id BIGINT NOT NULL,
  message_id      BIGINT NOT NULL UNIQUE,
  sentiment_score REAL NOT NULL,
  sentiment_label TEXT NOT NULL,
  emotions        JSONB NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_message_signals ON message_signals (tenant_id, conversation_id);

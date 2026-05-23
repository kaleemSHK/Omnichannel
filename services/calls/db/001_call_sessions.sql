-- BlinkOne call sessions + recording metadata (Prompt 5 step 6)
CREATE TABLE IF NOT EXISTS call_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           TEXT NOT NULL,
  room_id             TEXT NOT NULL,
  channel             TEXT NOT NULL DEFAULT 'voice',
  agent_label         TEXT,
  customer_phone      TEXT,
  queue_key           TEXT,
  status              TEXT NOT NULL DEFAULT 'ended',
  started_at          TIMESTAMPTZ NOT NULL,
  connected_at        TIMESTAMPTZ,
  ended_at            TIMESTAMPTZ,
  duration_ms         INTEGER,
  outcome             TEXT,
  asterisk_channel_id TEXT,
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_sessions_tenant ON call_sessions (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_sessions_room ON call_sessions (tenant_id, room_id);

CREATE TABLE IF NOT EXISTS recording_objects (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         TEXT NOT NULL,
  call_session_id   UUID REFERENCES call_sessions (id) ON DELETE SET NULL,
  storage_backend   TEXT NOT NULL DEFAULT 'local',
  storage_key       TEXT,
  content_type      TEXT DEFAULT 'audio/wav',
  encryption_key_id TEXT,
  duration_ms       INTEGER,
  started_at        TIMESTAMPTZ,
  ended_at          TIMESTAMPTZ,
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recording_objects_tenant ON recording_objects (tenant_id, created_at DESC);

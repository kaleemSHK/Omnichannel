CREATE TABLE IF NOT EXISTS recordings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       TEXT NOT NULL,
  call_id         TEXT NOT NULL,
  call_session_id TEXT,
  agent_id        TEXT,
  channel         TEXT NOT NULL DEFAULT 'voice',
  duration_sec    INT,
  duration_ms     INT,
  direction       TEXT CHECK (direction IN ('inbound', 'outbound')),
  storage_url     TEXT NOT NULL,
  storage_key     TEXT,
  transcription   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recordings_tenant ON recordings (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recordings_call ON recordings (call_id);
CREATE INDEX IF NOT EXISTS idx_recordings_session ON recordings (call_session_id);

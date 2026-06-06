-- BlinkOne calling agent view (additive — no DROP)
ALTER TABLE call_sessions
  ADD COLUMN IF NOT EXISTS conversation_id TEXT,
  ADD COLUMN IF NOT EXISTS contact_id       TEXT,
  ADD COLUMN IF NOT EXISTS transport        TEXT NOT NULL DEFAULT 'pstn',
  ADD COLUMN IF NOT EXISTS direction        TEXT NOT NULL DEFAULT 'inbound',
  ADD COLUMN IF NOT EXISTS assigned_agent_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'call_sessions_transport_check'
  ) THEN
    ALTER TABLE call_sessions ADD CONSTRAINT call_sessions_transport_check
      CHECK (transport IN ('pstn', 'whatsapp', 'webrtc'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'call_sessions_direction_check'
  ) THEN
    ALTER TABLE call_sessions ADD CONSTRAINT call_sessions_direction_check
      CHECK (direction IN ('inbound', 'outbound'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS call_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       TEXT NOT NULL,
  call_session_id UUID NOT NULL REFERENCES call_sessions (id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL,
  actor_id        TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_events_session ON call_events (call_session_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_call_sessions_conversation ON call_sessions (tenant_id, conversation_id);
CREATE INDEX IF NOT EXISTS idx_call_sessions_status ON call_sessions (tenant_id, status);

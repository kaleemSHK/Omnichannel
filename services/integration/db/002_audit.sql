-- TR-57 append-only audit log
CREATE TABLE IF NOT EXISTS blinkone_audit_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   TEXT NOT NULL,
  actor_id    TEXT NOT NULL DEFAULT 'system',
  action      TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id   TEXT NOT NULL,
  before      JSONB,
  after       JSONB,
  metadata    JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_tenant_time ON blinkone_audit_events (tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON blinkone_audit_events (tenant_id, actor_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON blinkone_audit_events (tenant_id, action, occurred_at DESC);

-- Immutability: revoke UPDATE/DELETE for app role (best-effort; role may not exist in dev)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'blinkone_app') THEN
    REVOKE UPDATE, DELETE ON blinkone_audit_events FROM blinkone_app;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION blinkone_audit_immutable()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'blinkone_audit_events is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_no_update ON blinkone_audit_events;
CREATE TRIGGER audit_no_update BEFORE UPDATE OR DELETE ON blinkone_audit_events
  FOR EACH ROW EXECUTE FUNCTION blinkone_audit_immutable();

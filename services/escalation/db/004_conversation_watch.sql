-- TR-24 conversation timer watch (unassigned / no-response)
CREATE TABLE IF NOT EXISTS escalation_conversation_watch (
  tenant_id                TEXT NOT NULL,
  conversation_id          BIGINT NOT NULL,
  status                   TEXT NOT NULL DEFAULT 'open',
  inbox_type               TEXT,
  assigned_agent           TEXT NOT NULL DEFAULT '',
  priority                 TEXT,
  sla_status               TEXT,
  opened_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  unassigned_since         TIMESTAMPTZ,
  last_customer_at         TIMESTAMPTZ,
  last_agent_at            TIMESTAMPTZ,
  unassigned_notified_at   TIMESTAMPTZ,
  no_response_notified_at  TIMESTAMPTZ,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_escalation_conv_watch_open
  ON escalation_conversation_watch (tenant_id, status)
  WHERE status = 'open';

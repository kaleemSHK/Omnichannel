-- BlinkOne tickets (Postgres migration from flat-file store)
CREATE TABLE IF NOT EXISTS tickets (
  id                        BIGSERIAL PRIMARY KEY,
  tenant_id                 TEXT,
  title                     TEXT NOT NULL,
  status                    TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'pending', 'in-progress', 'resolved')),
  priority                  TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  channel                   TEXT NOT NULL DEFAULT 'Chat',
  customer_name             TEXT NOT NULL DEFAULT 'Unknown',
  customer_email            TEXT NOT NULL DEFAULT '',
  department                TEXT NOT NULL DEFAULT 'Support',
  assigned_to               TEXT,
  chatwoot_account_id       BIGINT NOT NULL,
  chatwoot_conversation_id  BIGINT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tickets_account ON tickets (chatwoot_account_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_conversation ON tickets (chatwoot_account_id, chatwoot_conversation_id);

CREATE TABLE IF NOT EXISTS ticket_events (
  id          BIGSERIAL PRIMARY KEY,
  ticket_id   BIGINT NOT NULL REFERENCES tickets (id) ON DELETE CASCADE,
  at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  type        TEXT NOT NULL,
  message     TEXT NOT NULL,
  actor       TEXT NOT NULL DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS idx_ticket_events_ticket ON ticket_events (ticket_id, at);

CREATE TABLE IF NOT EXISTS ticket_fields (
  id          BIGSERIAL PRIMARY KEY,
  ticket_id   BIGINT NOT NULL REFERENCES tickets (id) ON DELETE CASCADE,
  key         TEXT NOT NULL,
  value       TEXT,
  UNIQUE (ticket_id, key)
);

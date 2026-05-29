-- Sprint 2 E01: Email threading — links RFC 2822 message IDs to tickets
-- Every inbound or outbound email message gets one row here.

CREATE TABLE IF NOT EXISTS email_threads (
  id           BIGSERIAL  PRIMARY KEY,
  ticket_id    BIGINT     NOT NULL REFERENCES tickets (id) ON DELETE CASCADE,
  message_id   TEXT       NOT NULL,           -- full RFC 2822 Message-ID incl. angle brackets
  in_reply_to  TEXT,                          -- In-Reply-To header (single ID)
  email_references  TEXT[],                   -- References header (ordered list of IDs)
  direction    TEXT       NOT NULL DEFAULT 'inbound'
               CHECK (direction IN ('inbound','outbound')),
  subject      TEXT,
  from_email   TEXT,
  from_name    TEXT,
  to_email     TEXT,
  body_text    TEXT,                          -- plain-text body, stored truncated to 8 kB
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Message-IDs must be globally unique; used for O(1) thread lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_threads_message_id
  ON email_threads (message_id);

-- Listing all messages for a ticket
CREATE INDEX IF NOT EXISTS idx_email_threads_ticket
  ON email_threads (ticket_id, created_at);

-- Finding a ticket from any known reference in a chain
CREATE INDEX IF NOT EXISTS idx_email_threads_in_reply_to
  ON email_threads (in_reply_to) WHERE in_reply_to IS NOT NULL;

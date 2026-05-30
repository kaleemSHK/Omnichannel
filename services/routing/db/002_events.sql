CREATE TABLE IF NOT EXISTS routing_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   text NOT NULL,
  call_id     text,
  agent_id    text,
  queue_id    text,
  outcome     text NOT NULL CHECK (outcome IN ('handled', 'abandoned', 'transferred')),
  wait_sec    int,
  talk_sec    int,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_routing_events_tenant_date
  ON routing_events (tenant_id, created_at);

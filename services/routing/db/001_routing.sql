-- BlinkOne routing / ACD (Prompt 5 step 4)
CREATE TABLE IF NOT EXISTS routing_queues (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           TEXT NOT NULL,
  queue_key           TEXT NOT NULL,
  name                TEXT NOT NULL,
  selection_algorithm TEXT NOT NULL DEFAULT 'longest_idle',
  max_wait_sec        INTEGER,
  max_depth           INTEGER,
  overflow_queue_id   UUID REFERENCES routing_queues (id) ON DELETE SET NULL,
  config              JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, queue_key)
);

CREATE INDEX IF NOT EXISTS idx_routing_queues_tenant ON routing_queues (tenant_id);

CREATE TABLE IF NOT EXISTS routing_queue_skills (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id   UUID NOT NULL REFERENCES routing_queues (id) ON DELETE CASCADE,
  skill      TEXT NOT NULL,
  required   BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (queue_id, skill)
);

CREATE TABLE IF NOT EXISTS routing_agents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       TEXT NOT NULL,
  agent_id        TEXT NOT NULL,
  display_name    TEXT,
  chatwoot_user_id TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_routing_agents_tenant ON routing_agents (tenant_id);

CREATE TABLE IF NOT EXISTS routing_agent_skills (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES routing_agents (id) ON DELETE CASCADE,
  skill    TEXT NOT NULL,
  UNIQUE (agent_id, skill)
);

CREATE TABLE IF NOT EXISTS routing_agent_queues (
  agent_id UUID NOT NULL REFERENCES routing_agents (id) ON DELETE CASCADE,
  queue_id UUID NOT NULL REFERENCES routing_queues (id) ON DELETE CASCADE,
  PRIMARY KEY (agent_id, queue_id)
);

CREATE TABLE IF NOT EXISTS routing_decisions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  TEXT NOT NULL,
  call_id    TEXT NOT NULL,
  queue_id   UUID REFERENCES routing_queues (id) ON DELETE SET NULL,
  decision   TEXT NOT NULL,
  agent_id   TEXT,
  metadata   JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_routing_decisions_tenant ON routing_decisions (tenant_id, created_at DESC);

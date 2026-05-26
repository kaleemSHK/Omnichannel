-- Sprint 1 G01: Weighted skill proficiency (1–5) + queue skill weights
-- Backward-compatible: existing rows get proficiency = 3 (mid-range default)

ALTER TABLE routing_agent_skills
  ADD COLUMN IF NOT EXISTS proficiency SMALLINT NOT NULL DEFAULT 3
    CHECK (proficiency BETWEEN 1 AND 5);

CREATE INDEX IF NOT EXISTS idx_routing_agent_skills_agent
  ON routing_agent_skills (agent_id);

-- Queue-level per-skill weight multipliers for best_match algorithm
-- Example: '{"spanish": 2.0, "tier2_support": 1.5}'
ALTER TABLE routing_queues
  ADD COLUMN IF NOT EXISTS skill_weights JSONB NOT NULL DEFAULT '{}';

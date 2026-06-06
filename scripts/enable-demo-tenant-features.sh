#!/usr/bin/env bash
# Enable Business-plan features (RAG, voice bot, telephony) for demo tenant 1.
set -euo pipefail
cd "$(dirname "$0")/.."

TENANT_ID="${TENANT_ID:-1}"
export PGPASSWORD="${APP_DB_PASSWORD:-$(grep '^APP_DB_PASSWORD=' .env | cut -d= -f2-)}"

echo "Enabling RAG + Business features for tenant ${TENANT_ID}…"
docker compose exec -T -e PGPASSWORD postgres_app psql -U app -d blinkone_app -v ON_ERROR_STOP=1 <<SQL
INSERT INTO tenant_features (tenant_id, feature_key, enabled, config) VALUES
  ('${TENANT_ID}', 'rag', true, '{}'),
  ('${TENANT_ID}', 'voice_bot', true, '{}'),
  ('${TENANT_ID}', 'agent_assist', true, '{}'),
  ('${TENANT_ID}', 'telephony', true, '{}'),
  ('${TENANT_ID}', 'calling.pstn', true, '{}'),
  ('${TENANT_ID}', 'sla', true, '{}'),
  ('${TENANT_ID}', 'escalation', true, '{}')
ON CONFLICT (tenant_id, feature_key) DO UPDATE SET enabled = EXCLUDED.enabled;

UPDATE tenants SET billing_plan_id = 'business', status = 'active' WHERE id = '${TENANT_ID}';
SQL

docker compose restart ai tenant 2>/dev/null || docker compose restart ai
echo "Done. Hard-refresh the browser and open AI → Knowledge base."

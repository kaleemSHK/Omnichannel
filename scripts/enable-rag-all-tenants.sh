#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export PGPASSWORD="${APP_DB_PASSWORD:-$(grep '^APP_DB_PASSWORD=' .env | cut -d= -f2-)}"
docker compose exec -T -e PGPASSWORD postgres_app psql -U app -d blinkone_app -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO tenant_features (tenant_id, feature_key, enabled, config)
SELECT t.id, 'rag', true, '{}'::jsonb FROM tenants t
ON CONFLICT (tenant_id, feature_key) DO UPDATE SET enabled = true;
SQL
docker compose restart ai tenant
echo "RAG enabled for all tenants; AI cache cleared via restart."

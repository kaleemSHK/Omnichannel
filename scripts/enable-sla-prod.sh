#!/usr/bin/env bash
set -euo pipefail
cd /opt/blinkone
docker compose exec -T postgres_app psql -U app -d blinkone_app <<'SQL'
INSERT INTO tenant_features (tenant_id, feature_key, enabled, config)
SELECT id, 'sla', true, '{}'::jsonb
FROM tenants
ON CONFLICT (tenant_id, feature_key) DO UPDATE SET enabled = true;
SQL
echo "SLA feature enabled for all tenants."

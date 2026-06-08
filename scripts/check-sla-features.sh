#!/usr/bin/env bash
set -euo pipefail
docker exec blinkone-postgres_app-1 psql -U app -d blinkone_app -c "SELECT tenant_id, feature_key, enabled FROM tenant_features WHERE tenant_id='1' AND feature_key='sla';"
docker exec blinkone-postgres_app-1 psql -U app -d blinkone_app -c "SELECT count(*) AS open_conversations FROM conversations;" 2>/dev/null || echo "skip chatwoot db"

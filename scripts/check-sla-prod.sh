#!/usr/bin/env bash
set -euo pipefail
cd /opt/blinkone
echo "=== SLA policies ==="
docker exec blinkone-postgres_app-1 psql -U app -d blinkone_app -c "SELECT name, is_default FROM sla_policies WHERE tenant_id='1';"
echo "=== SLA instances ==="
docker exec blinkone-postgres_app-1 psql -U app -d blinkone_app -c "SELECT count(*) FROM sla_instances WHERE tenant_id='1';"
echo "=== SLA worker log ==="
docker logs blinkone-sla-1 2>&1 | tail -5

#!/usr/bin/env bash
set -uo pipefail
cd /opt/blinkone

PGPASSWORD=$(grep '^APP_DB_PASSWORD=' .env | cut -d= -f2-)

echo "=== call_sessions by tenant_id + status ==="
docker compose exec -T -e PGPASSWORD postgres_app psql -U app -d blinkone_app -c \
  "SELECT tenant_id, status, COUNT(*) FROM call_sessions GROUP BY 1,2 ORDER BY 1,2;"

echo
echo "=== recent call_sessions (last 10) ==="
docker compose exec -T -e PGPASSWORD postgres_app psql -U app -d blinkone_app -c \
  "SELECT id, tenant_id, customer_phone, direction, status, outcome, started_at FROM call_sessions ORDER BY started_at DESC LIMIT 10;"

echo
echo "=== routing queues by tenant ==="
docker compose exec -T -e PGPASSWORD postgres_app psql -U app -d blinkone_app -c \
  "SELECT tenant_id, name FROM routing_queues ORDER BY tenant_id, name LIMIT 20;" 2>&1 | head -15

echo
echo "=== recording_objects count by tenant ==="
docker compose exec -T -e PGPASSWORD postgres_app psql -U app -d blinkone_app -c \
  "SELECT tenant_id, COUNT(*) FROM recording_objects GROUP BY 1;" 2>&1 | head -10

echo
echo "=== frontend NEXT_PUBLIC_USE_DEMO_DATA ==="
grep NEXT_PUBLIC_USE_DEMO_DATA frontend/.env.production frontend/.env.local 2>/dev/null || echo "(not set = live mode)"

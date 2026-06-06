#!/usr/bin/env bash
set -euo pipefail
cd /opt/blinkone

echo "=== one-time: close zombie call legs for tenant 1 ==="
PGPASSWORD=$(grep '^APP_DB_PASSWORD=' .env | cut -d= -f2-)
docker compose exec -T -e PGPASSWORD postgres_app psql -U app -d blinkone_app -v ON_ERROR_STOP=1 <<'SQL'
UPDATE call_sessions
SET status = 'missed', ended_at = NOW(), outcome = 'timeout'
WHERE tenant_id = '1' AND status = 'ringing';

UPDATE call_sessions
SET status = 'ended',
    ended_at = COALESCE(ended_at, NOW()),
    outcome = COALESCE(NULLIF(outcome, ''), 'completed'),
    duration_ms = COALESCE(
      duration_ms,
      GREATEST(0, EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000)::bigint
    )
WHERE tenant_id = '1' AND status IN ('connected', 'on_hold');

SELECT tenant_id, status, COUNT(*) FROM call_sessions WHERE tenant_id='1' GROUP BY 1,2 ORDER BY 2;
SQL

echo
echo "=== rebuild + recreate calls service (stale-call cleanup on read) ==="
docker compose build calls >/dev/null 2>&1 && echo built
docker compose up -d --force-recreate calls
sleep 4
docker compose ps calls

echo
echo "=== rebuild frontend ==="
cd frontend
npm run build
pm2 restart blinkone-frontend
echo DONE-WORKSPACE-FIX

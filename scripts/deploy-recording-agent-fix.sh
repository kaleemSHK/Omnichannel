#!/usr/bin/env bash
# Rebuild Docker images so calls/routing code changes actually run in containers.
set -euo pipefail
cd "${BLINKONE_ROOT:-/opt/blinkone}"

echo "=== Host code check ==="
grep -c lookupAgentDisplayName services/calls/lib/cdr-repo.js

echo "=== Docker rebuild: calls routing recording ==="
docker compose build calls routing recording
docker compose up -d --force-recreate calls routing recording
sleep 3

echo "=== Container code check ==="
docker compose exec -T calls grep -c lookupAgentDisplayName /app/lib/cdr-repo.js

echo "=== routing_agents (tenant 1) ==="
docker compose exec -T postgres_app psql -U app -d blinkone_app -t -A \
  -c "SELECT agent_id || '|' || COALESCE(display_name,'') FROM routing_agents WHERE tenant_id='1' ORDER BY agent_id;"

echo "=== recording_objects ==="
docker compose exec -T postgres_app psql -U app -d blinkone_app -t -A \
  -c "SELECT COUNT(*) FROM recording_objects;"

echo "=== Frontend rebuild ==="
cd frontend
pm2 stop blinkone-frontend 2>/dev/null || true
npm run build 2>&1 | tail -10
test -f .next/standalone/server.js
pm2 start blinkone-frontend --update-env 2>/dev/null || pm2 restart blinkone-frontend --update-env
pm2 save
pm2 reset blinkone-frontend 2>/dev/null || true

echo "=== Smoke ==="
curl -sf -o /dev/null -w "login:%{http_code}\n" https://app.blinksone.com/login
echo "DEPLOY_OK"

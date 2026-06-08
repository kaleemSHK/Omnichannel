#!/usr/bin/env bash
# Backfill SLA instances for open conversations that pre-date webhook fan-out.
set -euo pipefail
cd /opt/blinkone

TOKEN=$(docker exec blinkone-sla-1 printenv TOKEN 2>/dev/null || true)
if [[ -z "$TOKEN" ]]; then
  echo "SLA_TOKEN not set in sla container"
  exit 1
fi

docker cp scripts/backfill-sla-instances.rb blinkone-chatwoot-1:/tmp/backfill-sla-instances.rb
docker exec -e "SLA_TOKEN=${TOKEN}" blinkone-chatwoot-1 bundle exec rails runner /tmp/backfill-sla-instances.rb

docker exec blinkone-postgres_app-1 psql -U app -d blinkone_app -c "SELECT count(*) AS instances FROM sla_instances;"
docker exec blinkone-postgres_app-1 psql -U app -d blinkone_app -c \
  "SELECT conversation_id, status, due_at FROM sla_instances ORDER BY started_at DESC LIMIT 10;"

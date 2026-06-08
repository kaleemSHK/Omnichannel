#!/usr/bin/env bash
set -euo pipefail
TOKEN=$(docker exec blinkone-escalation-1 printenv TOKEN)
docker cp /opt/blinkone/scripts/backfill-escalation-watch.rb blinkone-chatwoot-1:/tmp/backfill-escalation-watch.rb
docker exec -e "ESCALATION_TOKEN=${TOKEN}" blinkone-chatwoot-1 bundle exec rails runner /tmp/backfill-escalation-watch.rb 2>/dev/null | tail -5
docker exec blinkone-postgres_app-1 psql -U app -d blinkone_app -c "SELECT count(*) AS watch_rows FROM escalation_conversation_watch;"
docker exec blinkone-postgres_app-1 psql -U app -d blinkone_app -c "SELECT count(*) AS total_runs FROM escalation_rule_runs;"

#!/usr/bin/env bash
set -euo pipefail
TOKEN=$(docker exec blinkone-escalation-1 printenv TOKEN)
cat > /tmp/esc-test.json << 'JSON'
{"event_type":"conversation.priority_changed_to","conversation_id":59,"conversation":{"id":59,"priority":"urgent"},"event":{"priority":"urgent"}}
JSON
docker cp /tmp/esc-test.json blinkone-escalation-1:/tmp/esc-test.json
docker exec blinkone-escalation-1 wget -qO- \
  --header="Authorization: Bearer ${TOKEN}" \
  --header="X-Blinkone-Tenant-Id: 1" \
  --header="Content-Type: application/json" \
  --post-file=/tmp/esc-test.json \
  http://127.0.0.1:8797/v1/events
echo
docker exec blinkone-postgres_app-1 psql -U app -d blinkone_app -c \
  "SELECT r.name, rr.conditions_passed FROM escalation_rule_runs rr JOIN escalation_rules r ON r.id = rr.rule_id ORDER BY rr.triggered_at DESC LIMIT 5;"

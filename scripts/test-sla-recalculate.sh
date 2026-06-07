#!/usr/bin/env bash
set -euo pipefail
cd /opt/blinkone
set -a
source .env
set +a
curl -sS -X POST "http://127.0.0.1:8796/v1/sla/recalculate" \
  -H "Authorization: Bearer ${SLA_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "X-Blinkone-Tenant-Id: 1" \
  -d '{"conversationId":999,"priority":"medium"}'
echo ""
docker exec blinkone-postgres_app-1 psql -U app -d blinkone_app -c "SELECT conversation_id, status FROM sla_instances WHERE tenant_id='1' LIMIT 5;"

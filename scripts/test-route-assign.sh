#!/bin/bash
set -euo pipefail
cd /opt/blinkone
. ./.env
TOKEN="${ROUTING_TOKEN:-blinkone-routing-token}"
CID="test-$(date +%s)"
BODY="{\"callId\":\"${CID}\",\"queueKey\":\"support\",\"callerId\":\"mobile\"}"
curl -sf -X POST "http://127.0.0.1:8798/v1/route/request" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "X-Blinkone-Tenant-Id: 1" \
  -H "Content-Type: application/json" \
  -d "$BODY" | python3 -m json.tool 2>/dev/null || cat

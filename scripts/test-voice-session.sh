#!/usr/bin/env bash
set -euo pipefail
cd /opt/blinkone
AI_TOKEN="$(grep '^AI_TOKEN=' .env | cut -d= -f2-)"
curl -s -w "\nHTTP:%{http_code}\n" -X POST "http://127.0.0.1:8787/api/ai/v1/voice/sessions" \
  -H "Authorization: Bearer ${AI_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "X-Blinkone-Tenant-Id: 1" \
  -d '{"call_id":"debug-1","inbox_id":"twilio-inbound","language":"ar-OM"}'

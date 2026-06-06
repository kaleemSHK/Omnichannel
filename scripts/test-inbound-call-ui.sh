#!/usr/bin/env bash
cd /opt/blinkone
CALLS_TOKEN="$(grep '^CALLS_TOKEN=' .env | cut -d= -f2-)"
curl -s -w "\nHTTP:%{http_code}\n" -X POST "http://127.0.0.1:8787/api/calls/v1/internal/calls/inbound" \
  -H "Authorization: Bearer ${CALLS_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "X-Blinkone-Tenant-Id: 1" \
  -d '{"callId":"CA-test-ui-2","customerPhone":"+96890000000"}'

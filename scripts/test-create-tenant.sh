#!/usr/bin/env bash
# Create tenant via gateway (platform admin JWT + tenant sidecar).
set -euo pipefail
cd /opt/blinkone

CW_URL="${CW_URL:-http://127.0.0.1:3000}"
GW_URL="${GW_URL:-http://127.0.0.1:8787}"

AUTH=$(curl -sf -X POST "${CW_URL}/auth/sign_in" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@blinksone.com","password":"Demo@2026!"}')
CW_TOKEN=$(echo "$AUTH" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['access_token'])")

GW=$(curl -sf -X POST "${GW_URL}/api/auth/token" \
  -H 'Content-Type: application/json' \
  -H "X-Api-Access-Token: ${CW_TOKEN}" \
  -H "api_access_token: ${CW_TOKEN}" \
  -d '{}')
JWT=$(echo "$GW" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

SLUG="test-$(date +%s)"
curl -sf -X POST "${GW_URL}/api/tenant/v1/tenants" \
  -H "Authorization: Bearer ${JWT}" \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"Test Co\",\"slug\":\"${SLUG}\",\"ownerEmail\":\"intelysysart@gmail.com\",\"plan\":\"trial\",\"billingPlanId\":\"starter\",\"features\":{\"rag\":true}}" \
  | python3 -m json.tool

echo "OK created slug=${SLUG}"

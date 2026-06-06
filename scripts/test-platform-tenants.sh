#!/usr/bin/env bash
# Login via gateway and list platform tenants (expects HTTP 200 + JSON array).
set -euo pipefail
cd "$(dirname "$0")/.."

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

curl -sf "${GW_URL}/api/platform/v1/tenants" \
  -H "Authorization: Bearer ${JWT}" | python3 -m json.tool

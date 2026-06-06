#!/usr/bin/env bash
# Quick calling API smoke test (run on demo server)
set -euo pipefail
cd /opt/blinkone
set -a
# shellcheck disable=SC1091
source .env
set +a

echo "=== Service token → GET /v1/cdr ==="
curl -sS -w "\nHTTP %{http_code}\n" \
  "http://127.0.0.1:8787/api/calls/v1/cdr?page=1&limit=3" \
  -H "Authorization: Bearer ${CALLS_TOKEN}" \
  -H "x-blinkone-tenant-id: 1" | tail -5

echo "=== Chatwoot token → gateway JWT → GET /v1/calls ==="
CW=$(docker compose exec -T chatwoot bundle exec rails runner \
  'u=User.find_by(email: "admin@blinksone.com"); puts u&.access_token&.token' 2>/dev/null | tr -d '\r' | tail -1)
JWT=$(curl -sS -X POST http://127.0.0.1:8787/api/auth/token \
  -H "api_access_token: ${CW}" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
echo "JWT length: ${#JWT}"
curl -sS -w "\nHTTP %{http_code}\n" \
  http://127.0.0.1:8787/api/calls/v1/calls \
  -H "Authorization: Bearer ${JWT}" | tail -5

echo "=== Gateway JWT → routing webrtc ==="
curl -sS -w "\nHTTP %{http_code}\n" \
  http://127.0.0.1:8787/api/routing/v1/agents/1/webrtc \
  -H "Authorization: Bearer ${JWT}" | tail -5

#!/usr/bin/env bash
set -uo pipefail
cd /opt/blinkone

echo "=== chatwoot cable/origin env ==="
docker compose exec -T chatwoot printenv 2>/dev/null \
  | grep -Ei 'ACTION_CABLE|ALLOWED_REQUEST_ORIGINS|FRONTEND_URL|CABLE|REDIS_URL|FORCE_SSL|RAILS_ENV' \
  | sed -E 's/(PASSWORD|TOKEN|SECRET)=.*/\1=<redacted>/'

echo
echo "=== sidekiq cable/origin env (should match) ==="
docker compose exec -T sidekiq printenv 2>/dev/null \
  | grep -Ei 'ACTION_CABLE|ALLOWED_REQUEST_ORIGINS|FRONTEND_URL' | head -10

echo
echo "=== .env relevant lines ==="
grep -Ei '^(FRONTEND_URL|ACTION_CABLE|CHATWOOT_HUB|RAILS_ENV)=' .env 2>/dev/null || echo "(none)"

echo
echo "=== simulate browser WS upgrade to /cable through nginx (origin app.blinksone.com) ==="
curl -s -i -o /dev/null -w "%{http_code}\n" \
  -H "Host: app.blinksone.com" \
  -H "Origin: https://app.blinksone.com" \
  -H "Upgrade: websocket" \
  -H "Connection: Upgrade" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  "http://127.0.0.1/cable" 2>&1 | tail -3 || echo "curl-missing"

echo
echo "=== recent chatwoot logs mentioning cable/origin ==="
docker compose logs --tail=200 chatwoot 2>&1 | grep -iE 'cable|origin|websocket|forbidden|request_origin' | tail -25
echo DONE-CABLE-ORIGIN

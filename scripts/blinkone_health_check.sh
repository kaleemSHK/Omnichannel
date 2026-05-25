#!/usr/bin/env bash
set -euo pipefail

echo "========================================="
echo "  BlinkOne Full Health Check"
echo "========================================="

echo ""
echo "--- Container Status ---"
cd /opt/blinkone && docker compose ps

echo ""
echo "--- Nginx ---"
if grep -q 'underscores_in_headers on' /etc/nginx/sites-available/blinkone 2>/dev/null; then
  echo "✅ underscores_in_headers enabled"
else
  echo "❌ underscores_in_headers MISSING (conversations API will 401)"
fi
systemctl is-active nginx && echo "✅ Nginx running" || echo "❌ Nginx DOWN"

echo ""
echo "--- PM2 Frontend ---"
pm2 status 2>/dev/null || echo "PM2 not running"

echo ""
echo "--- Chatwoot Auth ---"
AUTH_RESPONSE=$(curl -sf -X POST http://127.0.0.1:3000/auth/sign_in \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@blinksone.com","password":"Demo@2026!"}' || echo '{}')
ACCESS_TOKEN=$(echo "$AUTH_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('access_token',''))" 2>/dev/null || true)
if [ -n "$ACCESS_TOKEN" ]; then
  echo "✅ Chatwoot auth OK, token: ${ACCESS_TOKEN:0:20}..."
  COUNT=$(curl -sf "http://127.0.0.1:3000/api/v1/accounts/1/conversations?status=open" \
    -H "api_access_token: $ACCESS_TOKEN" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d['data']['payload']))" 2>/dev/null || echo 0)
  echo "   Open conversations: $COUNT"
else
  echo "❌ Chatwoot auth FAILED"
fi

echo ""
echo "--- Gateway ---"
curl -sf http://127.0.0.1:8787/health | python3 -c "import sys,json; print('✅ Gateway:', json.load(sys.stdin))" 2>/dev/null || echo "❌ Gateway down"

for svc_port in tickets:8791 sla:8796 escalation:8797 routing:8798; do
  name="${svc_port%%:*}"
  port="${svc_port##*:}"
  if curl -sf "http://127.0.0.1:${port}/health" >/dev/null 2>&1; then
    echo "✅ $name (/health on :$port)"
  elif curl -sf "http://127.0.0.1:${port}/healthz" >/dev/null 2>&1; then
    echo "✅ $name (/healthz on :$port)"
  else
    echo "❌ $name not responding on :$port"
  fi
done

echo ""
echo "========================================="
echo "  https://app.blinksone.com/login"
echo "  admin@blinksone.com / Demo@2026!"
echo "========================================="

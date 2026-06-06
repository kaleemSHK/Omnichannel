#!/usr/bin/env bash
set -euo pipefail
cd /opt/blinkone

echo "=== verify whatsapp-calls route in gateway source ==="
grep -c 'whatsappCalls' gateway/src/index.js
grep 'route.*whatsapp-calls' gateway/src/index.js

echo
echo "=== rebuild gateway (repo-root context for lib + _shared) ==="
docker compose build gateway
docker compose up -d --force-recreate gateway
sleep 5
docker compose ps gateway

echo
echo "=== gateway health ==="
curl -sf http://127.0.0.1:8787/health | head -c 200
echo

echo
echo "=== whatsapp-calls upstream health (direct) ==="
docker compose exec -T whatsapp-calls wget -qO- http://127.0.0.1:8803/health 2>/dev/null | head -c 200 || echo "whatsapp-calls health skip"
echo

echo
echo "=== proxied route without JWT (expect 401) ==="
curl -sf -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1:8787/api/whatsapp-calls/v1/config || true

echo "DONE-GATEWAY-WHATSAPP"

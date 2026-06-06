#!/usr/bin/env bash
set -uo pipefail
cd /opt/blinkone

echo "=== last 60 cable-related chatwoot log lines ==="
docker compose logs --tail=1500 chatwoot 2>&1 \
  | grep -iE 'cable|websocket|unauthorized|rejected|Registered connection|Finished .*WebSocket|subscrib' \
  | tail -60

echo
echo "=== count: started vs finished WS in recent logs ==="
LOGS=$(docker compose logs --tail=3000 chatwoot 2>&1)
echo "Started  [WebSocket]: $(echo "$LOGS" | grep -c 'Started GET "/cable')"
echo "Finished [WebSocket]: $(echo "$LOGS" | grep -c 'Finished .*\[WebSocket\]')"
echo "Unauthorized/Rejected: $(echo "$LOGS" | grep -ciE 'unauthorized|reject')"

echo
echo "=== puma / cable listener inside container (port 3000 bind) ==="
docker compose exec -T chatwoot sh -lc "(ss -ltnp 2>/dev/null || netstat -ltnp 2>/dev/null) | grep -E ':3000' | head" 2>&1 | head

echo
echo "=== in-container cable upgrade test (127.0.0.1, proper WS headers) ==="
docker compose exec -T chatwoot sh -lc "wget -qS -O- --header='Origin: https://app.blinksone.com' --header='Upgrade: websocket' --header='Connection: Upgrade' --header='Sec-WebSocket-Version: 13' --header='Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' 'http://127.0.0.1:3000/cable' 2>&1 | head -15" 2>&1 | head -20
echo DONE-CABLE-LOGS

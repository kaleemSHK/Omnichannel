#!/usr/bin/env bash
set -uo pipefail
cd /opt/blinkone

echo "=== TLS cert served on wss://ws.blinksone.com (SNI) ==="
echo | openssl s_client -servername ws.blinksone.com -connect ws.blinksone.com:443 2>/dev/null \
  | openssl x509 -noout -subject -ext subjectAltName 2>/dev/null | head -4

echo
echo "=== public /cable handshake via ws.blinksone.com (expect 101) ==="
curl -s -i -k --max-time 8 \
  -H "Origin: https://app.blinksone.com" \
  -H "Upgrade: websocket" -H "Connection: Upgrade" \
  -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  "https://ws.blinksone.com/cable" 2>&1 | grep -iE 'HTTP/|sec-websocket-accept' | head -3

echo
echo "=== public /ws/routing/v1/realtime handshake via ws.blinksone.com (expect 101/401, NOT 404/502) ==="
curl -s -i -k --max-time 8 \
  -H "Upgrade: websocket" -H "Connection: Upgrade" \
  -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  "https://ws.blinksone.com/ws/routing/v1/realtime?tenant_id=1&token=x" 2>&1 | grep -iE 'HTTP/' | head -2

echo
echo "=== frontend env files: current WS-related values ==="
for f in frontend/.env.local frontend/.env.production frontend/.env; do
  [ -f "$f" ] || continue
  echo "--- $f ---"
  grep -nE 'NEXT_PUBLIC_WS_URL|NEXT_PUBLIC_WS_HOST|NEXT_PUBLIC_CHATWOOT_URL' "$f" || echo "(no WS vars)"
done
echo DONE-WS-VERIFY

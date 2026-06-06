#!/usr/bin/env bash
set -uo pipefail

echo "=== nginx sip.blinksone.com server block (full) ==="
awk '/server_name sip.blinksone.com;/{f=1} f{print} f&&/^}/{exit}' /etc/nginx/sites-available/blinkone 2>/dev/null | head -60 || echo "block not found"

echo
echo "=== WS handshake test to local Kamailio xhttp (127.0.0.1:8088) ==="
curl -sS -i --max-time 6 \
  -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  -H "Sec-WebSocket-Protocol: sip" \
  http://127.0.0.1:8088/ 2>&1 | head -20 || echo "curl to 8088 failed"

echo
echo "=== WS handshake test via public TLS (wss://sip.blinksone.com) ==="
curl -sS -i --max-time 8 \
  -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  -H "Sec-WebSocket-Protocol: sip" \
  https://sip.blinksone.com/ 2>&1 | head -20 || echo "curl to public sip failed"

echo
echo "=== Recent Kamailio log lines (registration/handshake) ==="
journalctl -u kamailio --no-pager -n 30 2>/dev/null | tail -30 || tail -30 /var/log/kamailio.log 2>/dev/null || echo "no kamailio log"
echo "DONE"

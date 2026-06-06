#!/usr/bin/env bash
echo "=== Kamailio ===" && systemctl is-active kamailio
echo "=== Nginx ===" && systemctl is-active nginx
echo "=== PM2 Frontend ===" && pm2 status 2>/dev/null | grep blinkone || true
echo "=== SIP Ports (TCP) ===" && ss -tlnup | grep -E '5060|8088' || true
echo "=== SIP Ports (UDP) ===" && ss -ulnp | grep 5060 || true
echo "=== Nginx /sip block ===" && grep -A5 'location /sip' /etc/nginx/sites-available/blinkone
echo "=== Frontend SIP env ===" && grep SIP /opt/blinkone/frontend/.env.production
echo "=== WebSocket handshake (local 8088) ==="
curl -si -N -m 3 \
  -H 'Connection: Upgrade' \
  -H 'Upgrade: websocket' \
  -H 'Host: app.blinksone.com' \
  -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' \
  -H 'Sec-WebSocket-Version: 13' \
  http://127.0.0.1:8088/ 2>&1 | head -8
echo "=== WebSocket via HTTPS /sip (local nginx) ==="
curl -ski -N -m 3 --resolve app.blinksone.com:443:127.0.0.1 \
  -H 'Connection: Upgrade' \
  -H 'Upgrade: websocket' \
  -H 'Host: app.blinksone.com' \
  -H 'Sec-WebSocket-Protocol: sip' \
  -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' \
  -H 'Sec-WebSocket-Version: 13' \
  https://app.blinksone.com/sip 2>&1 | head -8
echo "=== Registered SIP contacts (kamcmd) ==="
kamcmd ul.dump 2>/dev/null | head -20 || echo "(no registrations yet — log in to BlinkOne Calling first)"

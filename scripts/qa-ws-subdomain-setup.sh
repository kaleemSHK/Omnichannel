#!/usr/bin/env bash
set -uo pipefail

CONF=/etc/nginx/sites-enabled/blinkone
STAMP=$(date +%Y%m%d-%H%M%S)

echo "=== backup nginx conf -> ${CONF}.bak-${STAMP} ==="
cp "$CONF" "${CONF}.bak-${STAMP}"

if grep -q 'server_name ws.blinksone.com' "$CONF"; then
  echo "ws.blinksone.com server block already present; skipping append."
else
  echo "=== appending ws.blinksone.com server blocks ==="
  cat >> "$CONF" <<'NGINX'

# ── ws.blinksone.com (DNS-only / grey-cloud) — persistent WebSockets, no CDN recycling ──
server {
    listen 80;
    server_name ws.blinksone.com;
    location /.well-known/acme-challenge/ { root /var/www/html; }
    location / { return 301 https://$host$request_uri; }
}

server {
    listen 443 ssl;
    server_name ws.blinksone.com;
    underscores_in_headers on;

    ssl_certificate /etc/letsencrypt/live/blinksone.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/blinksone.com/privkey.pem;

    # Chatwoot Action Cable
    location = /cable {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    # BlinkOne routing wallboard realtime
    location /ws/routing/ {
        proxy_pass http://127.0.0.1:8798/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    location / { return 404; }
}
NGINX
fi

mkdir -p /var/www/html

echo
echo "=== nginx -t ==="
if ! nginx -t 2>&1; then
  echo "!! nginx config invalid — restoring backup"
  cp "${CONF}.bak-${STAMP}" "$CONF"
  nginx -t
  exit 1
fi
systemctl reload nginx
echo "nginx reloaded."

echo
echo "=== expand LE cert to include ws.blinksone.com ==="
certbot certonly --nginx --cert-name blinksone.com --expand --non-interactive --agree-tos \
  -d blinksone.com -d app.blinksone.com -d www.blinksone.com -d sip.blinksone.com -d ws.blinksone.com 2>&1 | tail -20

echo
echo "=== verify cert SAN now includes ws.blinksone.com ==="
openssl x509 -in /etc/letsencrypt/live/blinksone.com/fullchain.pem -noout -ext subjectAltName 2>/dev/null

systemctl reload nginx

echo
echo "=== direct origin handshake tests (bypass CDN) ==="
echo "-- /cable (expect 101) --"
docker compose -f /opt/blinkone/docker-compose.yml exec -T chatwoot sh -lc "wget -qS -O- --header='Origin: https://app.blinksone.com' --header='Upgrade: websocket' --header='Connection: Upgrade' --header='Sec-WebSocket-Version: 13' --header='Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' 'http://127.0.0.1:3000/cable' 2>&1 | grep -i 'HTTP/' | head -1" 2>&1 | head -2

echo "-- routing service /v1/realtime upgrade (expect 101 or 401/400, NOT connection refused) --"
docker compose -f /opt/blinkone/docker-compose.yml exec -T routing sh -lc "wget -qS -O- --header='Upgrade: websocket' --header='Connection: Upgrade' --header='Sec-WebSocket-Version: 13' --header='Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' 'http://127.0.0.1:8798/v1/realtime?tenant_id=1&token=x' 2>&1 | grep -i 'HTTP/' | head -1" 2>&1 | head -2

echo DONE-WS-SETUP

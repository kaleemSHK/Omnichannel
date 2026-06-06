#!/usr/bin/env bash
# PROMPT_26 — Kamailio + Nginx SIP + frontend env (run on demo server as root)
set -euo pipefail

BLINKONE_ROOT="${BLINKONE_ROOT:-/opt/blinkone}"
KAM_CFG_SRC="${BLINKONE_ROOT}/infra/kamailio/kamailio-twilio-wss.cfg"

echo "=== PART B — UFW (optional; skip if inactive) ==="
if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q inactive; then
  echo "UFW inactive — skipping rules (iptables open by default)"
else
  ufw allow from 54.172.60.0/23 to any port 5060 proto udp comment "Twilio SIP US1" || true
  ufw allow from 54.244.51.0/24 to any port 5060 proto udp comment "Twilio SIP US-West" || true
  ufw allow from 54.171.127.192/26 to any port 5060 proto udp comment "Twilio SIP EU" || true
  ufw allow from 35.156.191.128/25 to any port 5060 proto udp comment "Twilio SIP EU-F" || true
  ufw allow 5060/udp comment "SIP UDP" || true
  ufw allow 5061/tcp comment "SIP TLS" || true
  ufw allow 10000:20000/udp comment "RTP media" || true
fi

echo "=== PART C — RTPEngine (WebRTC ↔ Twilio RTP) ==="
if [ -x "${BLINKONE_ROOT}/scripts/setup_rtpengine_demo.sh" ]; then
  bash "${BLINKONE_ROOT}/scripts/setup_rtpengine_demo.sh"
else
  echo "Missing setup_rtpengine_demo.sh — Kamailio needs UDP 22222"
  exit 1
fi

echo "=== PART C — Install Kamailio ==="
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq kamailio kamailio-extra-modules kamailio-websocket-modules kamailio-utils-modules

if [ -f "$KAM_CFG_SRC" ]; then
  cp /etc/kamailio/kamailio.cfg /etc/kamailio/kamailio.cfg.bak."$(date +%s)" 2>/dev/null || true
  cp "$KAM_CFG_SRC" /etc/kamailio/kamailio.cfg
else
  echo "Missing $KAM_CFG_SRC — copy infra/kamailio/kamailio-twilio-wss.cfg to server first"
  exit 1
fi

kamailio -c -f /etc/kamailio/kamailio.cfg
systemctl enable kamailio
systemctl restart kamailio
sleep 2
systemctl is-active kamailio && echo "✅ Kamailio running"

echo "=== PART D — Nginx /sip proxy ==="
NGINX_SITE=/etc/nginx/sites-available/blinkone
if ! grep -q 'location /sip' "$NGINX_SITE"; then
  sed -i '/# Next.js frontend/i\    # SIP WebSocket — proxy to Kamailio\n    location /sip {\n        proxy_pass http://127.0.0.1:8088/;\n        proxy_http_version 1.1;\n        proxy_set_header Upgrade $http_upgrade;\n        proxy_set_header Connection "upgrade";\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_read_timeout 3600s;\n        proxy_send_timeout 3600s;\n    }\n' "$NGINX_SITE"
fi
nginx -t
systemctl reload nginx
echo "✅ Nginx SIP proxy"

echo "=== PART E — Frontend .env.production ==="
cat > "${BLINKONE_ROOT}/frontend/.env.production" << 'ENV_EOF'
NEXT_PUBLIC_CHATWOOT_URL=https://app.blinksone.com
NEXT_PUBLIC_API_BASE=https://app.blinksone.com
NEXT_PUBLIC_WS_URL=wss://app.blinksone.com/cable

# Grey-cloud sip host — app.blinksone.com/sip breaks behind Cloudflare proxy
NEXT_PUBLIC_SIP_WSS=wss://sip.blinksone.com
NEXT_PUBLIC_SIP_DOMAIN=intelysys.pstn.twilio.com
NEXT_PUBLIC_SIP_USER=blinkone
NEXT_PUBLIC_SIP_PASS=BlinkSip2026!

NEXT_PUBLIC_USE_DEMO_DATA=false
ENV_EOF

cd "${BLINKONE_ROOT}/frontend"
npm run build
pm2 restart blinkone-frontend
pm2 save

echo "=== PART G — Verify ==="
ss -tlnup | grep -E '5060|8088' || true
grep SIP "${BLINKONE_ROOT}/frontend/.env.production"
grep -A4 'location /sip' "$NGINX_SITE" || true
echo "✅ PROMPT_26 deploy complete"

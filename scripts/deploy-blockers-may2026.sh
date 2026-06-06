#!/usr/bin/env bash
# Deploy customer auth, per-agent SIP, TURN, device push, peer calling (May 2026 blockers).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${BLINKONE_HOST:-root@204.168.137.104}"
REMOTE="${BLINKONE_REMOTE:-/opt/blinkone}"
SSH_OPTS=(-o BatchMode=yes -o StrictHostKeyChecking=accept-new)

FILES=(
  gateway/src/index.js
  gateway/lib/customer-routes.js
  gateway/lib/device-routes.js
  gateway/lib/sip-secret.js
  services/routing/src/server.js
  services/routing/lib/sip-secret.js
  services/tickets/src/server.js
  services/tickets/lib/ticket-repo.js
  infra/kamailio/kamailio-twilio-wss.cfg
  infra/coturn/turnserver.conf
  docker-compose.yml
  frontend/src/lib/hooks/useJsSip.ts
)

echo "=== Sync files to ${HOST} ==="
for f in "${FILES[@]}"; do
  dir=$(dirname "$f")
  ssh "${SSH_OPTS[@]}" "$HOST" "mkdir -p ${REMOTE}/${dir}"
  scp "${SSH_OPTS[@]}" "$ROOT/$f" "${HOST}:${REMOTE}/$f"
done

echo "=== Remote build + restart ==="
ssh "${SSH_OPTS[@]}" "$HOST" bash -s <<'REMOTE_EOF'
set -euo pipefail
cd /opt/blinkone

# Kamailio peer-route config
if [ -f infra/kamailio/kamailio-twilio-wss.cfg ]; then
  cp /etc/kamailio/kamailio.cfg /etc/kamailio/kamailio.cfg.bak."$(date +%s)" 2>/dev/null || true
  cp infra/kamailio/kamailio-twilio-wss.cfg /etc/kamailio/kamailio.cfg
  kamailio -c -f /etc/kamailio/kamailio.cfg
  systemctl restart kamailio
  systemctl is-active kamailio && echo "Kamailio OK"
fi

docker compose build gateway routing tickets
docker compose up -d --force-recreate gateway routing tickets

# Coturn (optional — may fail if image pull blocked; routing still gets STUN)
docker compose up -d coturn 2>/dev/null || echo "coturn skipped"

cd frontend
npm run build
pm2 restart blinkone-frontend
pm2 save

echo "=== Smoke tests ==="
curl -sf -o /dev/null -w "gateway health %{http_code}\n" http://127.0.0.1:8787/health || true
curl -sf -X POST http://127.0.0.1:8787/api/customer/session \
  -H 'Content-Type: application/json' \
  -d '{"name":"Deploy Test"}' | head -c 200 || echo "customer session check failed (set CUSTOMER_CHATWOOT_TOKEN)"
echo ""
echo "Deploy blockers complete."
REMOTE_EOF

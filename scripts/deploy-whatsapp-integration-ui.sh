#!/usr/bin/env bash
# Deploy WhatsApp integration fields (platform API + whatsapp-calls runtime + inbox UI).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${BLINKONE_HOST:-root@204.168.137.104}"
REMOTE="${BLINKONE_REMOTE:-/opt/blinkone}"
SSH_OPTS=(-o BatchMode=yes -o StrictHostKeyChecking=accept-new)

FILES=(
  docker-compose.yml
  services/platform/src/server.js
  services/whatsapp-calls/lib/runtime-config.js
  services/whatsapp-calls/lib/messaging.js
  services/whatsapp-calls/lib/meta-webhook.js
  services/whatsapp-calls/lib/chatwoot-bridge.js
  services/whatsapp-calls/src/server.js
  frontend/src/lib/api/whatsapp-config.ts
  frontend/src/components/settings/inbox/WhatsAppIntegrationPanel.tsx
  frontend/src/components/settings/inbox/InboxEditDrawer.tsx
)

echo "Syncing WhatsApp integration to ${HOST}…"
for f in "${FILES[@]}"; do
  scp "${SSH_OPTS[@]}" "$ROOT/$f" "${HOST}:${REMOTE}/$f"
done

ssh "${SSH_OPTS[@]}" "$HOST" bash -s <<EOF
set -euo pipefail
cd ${REMOTE}
docker compose build platform whatsapp-calls
docker compose up -d platform whatsapp-calls
cd frontend
npm run build
pm2 restart blinkone-frontend
echo "WhatsApp integration UI deployed."
EOF

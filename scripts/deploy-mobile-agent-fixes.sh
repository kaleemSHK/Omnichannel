#!/usr/bin/env bash
# Deploy agent mobile fixes + omnichannel (frontend, gateway, calls, recording).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${BLINKONE_HOST:-root@204.168.137.104}"
REMOTE="${BLINKONE_REMOTE:-/opt/blinkone}"
SSH_OPTS=(-o BatchMode=yes -o StrictHostKeyChecking=accept-new)

FILES=(
  docker-compose.yml
  gateway/lib/push.js
  gateway/lib/device-routes.js
  gateway/lib/customer-routes.js
  services/routing/lib/call-queue-status.js
  services/routing/lib/route-request.js
  services/routing/lib/queue-worker.js
  services/routing/lib/agent-repo.js
  services/routing/src/server.js
  services/calls/lib/push-notify.js
  services/calls/lib/chatwoot-broadcast.js
  services/recording/lib/stt-hook.js
  services/recording/src/server.js
  frontend/src/lib/api/routing.ts
  frontend/src/lib/hooks/useJsSip.ts
  frontend/src/components/conversations/ConversationIncomingCallBanner.tsx
  frontend/src/components/conversations/MessageThread.tsx
  frontend/src/lib/utils/calling.ts
  frontend/src/types/index.ts
)

echo "=== Sync ${#FILES[@]} files to ${HOST} ==="
for f in "${FILES[@]}"; do
  dir=$(dirname "$f")
  ssh "${SSH_OPTS[@]}" "$HOST" "mkdir -p ${REMOTE}/${dir}"
  scp "${SSH_OPTS[@]}" "$ROOT/$f" "${HOST}:${REMOTE}/$f"
done

echo "=== Remote build + restart ==="
ssh "${SSH_OPTS[@]}" "$HOST" bash -s <<'REMOTE_EOF'
set -euo pipefail
cd /opt/blinkone

touch .env
grep -q '^PUSH_CALLS_ENABLED=' .env || echo 'PUSH_CALLS_ENABLED=1' >> .env
grep -q '^AUTO_STT_ON_RECORDING=' .env || echo 'AUTO_STT_ON_RECORDING=1' >> .env
grep -q '^STT_LANGUAGE_HINT=' .env || echo 'STT_LANGUAGE_HINT=ar-OM' >> .env
grep -q '^FCM_SERVER_KEY=' .env || echo 'FCM_SERVER_KEY=' >> .env

docker compose build gateway calls recording routing
docker compose up -d --force-recreate gateway calls recording routing

cd frontend
pm2 stop blinkone-frontend 2>/dev/null || true
npm run build 2>&1 | tail -30
cp -r public .next/standalone/public 2>/dev/null || true
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
test -f .next/standalone/server.js && echo "standalone OK" || (echo "standalone MISSING" && exit 1)
pm2 start blinkone-frontend --update-env 2>/dev/null || pm2 restart blinkone-frontend --update-env
pm2 save

echo "=== Smoke ==="
curl -sf -o /dev/null -w "gateway %{http_code}\n" http://127.0.0.1:8787/health
curl -sf -o /dev/null -w "app %{http_code}\n" https://app.blinksone.com/login
echo "Deploy complete."
REMOTE_EOF

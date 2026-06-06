#!/usr/bin/env bash
# Deploy: conversation call banner, FCM push wake, post-call STT hook.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${BLINKONE_HOST:-root@204.168.137.104}"
REMOTE="${BLINKONE_REMOTE:-/opt/blinkone}"
SSH_OPTS=(-o BatchMode=yes -o StrictHostKeyChecking=accept-new)

FILES=(
  gateway/lib/push.js
  gateway/lib/device-routes.js
  services/calls/lib/push-notify.js
  services/calls/lib/chatwoot-broadcast.js
  services/recording/lib/stt-hook.js
  services/recording/src/server.js
  docker-compose.yml
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

# Ensure new env keys exist (do not overwrite existing values)
touch .env
grep -q '^PUSH_CALLS_ENABLED=' .env || echo 'PUSH_CALLS_ENABLED=0' >> .env
grep -q '^AUTO_STT_ON_RECORDING=' .env || echo 'AUTO_STT_ON_RECORDING=1' >> .env
grep -q '^STT_LANGUAGE_HINT=' .env || echo 'STT_LANGUAGE_HINT=ar-OM' >> .env
grep -q '^FCM_SERVER_KEY=' .env || echo 'FCM_SERVER_KEY=' >> .env

docker compose build gateway calls recording
docker compose up -d --force-recreate gateway calls recording

cd frontend
npm run build 2>&1 | tail -25
cp -r public .next/standalone/public 2>/dev/null || true
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
test -f .next/standalone/server.js && echo "standalone OK" || (echo "standalone MISSING" && exit 1)
pm2 restart blinkone-frontend --update-env
pm2 save

echo "=== Smoke ==="
curl -sf -o /dev/null -w "gateway %{http_code}\n" http://127.0.0.1:8787/health
curl -sf -o /dev/null -w "calls %{http_code}\n" http://127.0.0.1:8792/health || curl -sf -o /dev/null -w "calls via compose %{http_code}\n" http://127.0.0.1:8080/api/calls/health 2>/dev/null || true
curl -sf -o /dev/null -w "recording %{http_code}\n" http://127.0.0.1:8799/health || true
curl -sf -o /dev/null -w "app login %{http_code}\n" https://app.blinksone.com/login
echo "Deploy omnichannel/push/stt complete."
REMOTE_EOF

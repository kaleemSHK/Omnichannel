#!/usr/bin/env bash
# Deploy frontend gateway/RAG/platform UI fixes to production.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${BLINKONE_HOST:-root@204.168.137.104}"
REMOTE="${BLINKONE_REMOTE:-/opt/blinkone}"

echo "Syncing frontend sources…"
scp -o BatchMode=yes \
  "$ROOT/frontend/src/lib/api/client.ts" \
  "${HOST}:${REMOTE}/frontend/src/lib/api/client.ts"
scp -o BatchMode=yes \
  "$ROOT/frontend/src/app/layout.tsx" \
  "${HOST}:${REMOTE}/frontend/src/app/layout.tsx"
scp -o BatchMode=yes \
  "$ROOT/frontend/public/icon.svg" \
  "${HOST}:${REMOTE}/frontend/public/icon.svg"
scp -o BatchMode=yes \
  "$ROOT/frontend/.env.production" \
  "${HOST}:${REMOTE}/frontend/.env.production"

ssh -o BatchMode=yes "$HOST" bash -s <<EOF
set -euo pipefail
cd ${REMOTE}/frontend
npm run build
pm2 restart blinkone-frontend
echo "Frontend deployed."
EOF

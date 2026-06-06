#!/usr/bin/env bash
# Deploy outbound ringback + Action Cable subscription-churn fixes to production.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${BLINKONE_HOST:-root@204.168.137.104}"
REMOTE="${BLINKONE_REMOTE:-/opt/blinkone}"

echo "Syncing frontend sources…"
scp -o BatchMode=yes \
  "$ROOT/frontend/src/lib/telephony/ringtone.ts" \
  "${HOST}:${REMOTE}/frontend/src/lib/telephony/ringtone.ts"
scp -o BatchMode=yes \
  "$ROOT/frontend/src/lib/hooks/useJsSip.ts" \
  "${HOST}:${REMOTE}/frontend/src/lib/hooks/useJsSip.ts"
scp -o BatchMode=yes \
  "$ROOT/frontend/src/components/calling/PhonePanel.tsx" \
  "${HOST}:${REMOTE}/frontend/src/components/calling/PhonePanel.tsx"

ssh -o BatchMode=yes "$HOST" bash -s <<'EOF'
set -euo pipefail
cd /opt/blinkone/frontend
echo "Building frontend…"
npm run build
pm2 restart blinkone-frontend
echo "FRONTEND-DEPLOYED"
EOF

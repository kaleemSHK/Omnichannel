#!/usr/bin/env bash
# Revert premium calling cockpit → classic CallingWorkspace UI.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${BLINKONE_HOST:-root@204.168.137.104}"
REMOTE="${BLINKONE_REMOTE:-/opt/blinkone}"
SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=20)

echo "=== Sync reverted calling UI ==="
scp "${SSH_OPTS[@]}" \
  "$ROOT/frontend/src/components/calling/CallingWorkspace.tsx" \
  "${HOST}:${REMOTE}/frontend/src/components/calling/CallingWorkspace.tsx"
scp "${SSH_OPTS[@]}" \
  "$ROOT/frontend/src/app/(dashboard)/layout.tsx" \
  "${HOST}:${REMOTE}/frontend/src/app/(dashboard)/layout.tsx"
scp "${SSH_OPTS[@]}" \
  "$ROOT/frontend/src/styles/globals.css" \
  "${HOST}:${REMOTE}/frontend/src/styles/globals.css"

ssh "${SSH_OPTS[@]}" "$HOST" bash -s <<EOF
set -euo pipefail
rm -f ${REMOTE}/frontend/src/app/'(dashboard)'/calling/layout.tsx
rm -rf ${REMOTE}/frontend/src/components/calling/workspace
cd ${REMOTE}/frontend
npm run build 2>&1 | tail -20
pm2 restart blinkone-frontend --update-env
pm2 save
echo "CALLING-UI-REVERT-DEPLOYED"
EOF

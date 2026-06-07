#!/usr/bin/env bash
# Deploy conversation Priority + Macros UI to production.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${BLINKONE_HOST:-root@204.168.137.104}"
REMOTE="${BLINKONE_REMOTE:-/opt/blinkone}"
SSH_OPTS=(-o BatchMode=yes -o StrictHostKeyChecking=accept-new)

FILES=(
  frontend/src/types/index.ts
  frontend/src/lib/api/conversations.ts
  frontend/src/lib/api/settings.ts
  frontend/src/components/conversations/PriorityPicker.tsx
  frontend/src/components/conversations/MacroPicker.tsx
  frontend/src/components/conversations/MessageThread.tsx
)

echo "Syncing conversation priority + macros UI to ${HOST}…"
for f in "${FILES[@]}"; do
  scp "${SSH_OPTS[@]}" "$ROOT/$f" "${HOST}:${REMOTE}/$f"
done

ssh "${SSH_OPTS[@]}" "$HOST" bash -s <<EOF
set -euo pipefail
cd ${REMOTE}/frontend
npm run build
pm2 restart blinkone-frontend
echo "Conversation priority + macros UI deployed."
EOF

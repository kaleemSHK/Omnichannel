#!/usr/bin/env bash
# Deploy Settings fixes (labels crash + custom attribute key on create).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${BLINKONE_HOST:-root@204.168.137.104}"
REMOTE="${BLINKONE_REMOTE:-/opt/blinkone}"
# Git Bash / non-interactive scp won't prompt for host keys (BatchMode=yes).
SSH_OPTS=(-o BatchMode=yes -o StrictHostKeyChecking=accept-new)

FILES=(
  frontend/src/lib/api/client.ts
  frontend/src/lib/api/settings.ts
  frontend/src/lib/labels/normalize.ts
  frontend/src/lib/hooks/useChatwootExtras.ts
  frontend/src/components/settings/LabelsSection.tsx
  frontend/src/components/settings/CustomAttrsSection.tsx
  frontend/src/components/settings/TicketFieldsSettings.tsx
  frontend/src/lib/api/ticketFields.ts
  frontend/src/lib/demo/ticketFieldsFixture.ts
  frontend/src/components/conversations/LabelPicker.tsx
)

echo "Syncing label fix files to ${HOST}…"
ssh "${SSH_OPTS[@]}" "$HOST" "mkdir -p ${REMOTE}/frontend/src/lib/labels"
for f in "${FILES[@]}"; do
  scp "${SSH_OPTS[@]}" "$ROOT/$f" "${HOST}:${REMOTE}/$f"
done

ssh "${SSH_OPTS[@]}" "$HOST" bash -s <<EOF
set -euo pipefail
cd ${REMOTE}/frontend
npm run build
pm2 restart blinkone-frontend
echo "Labels settings fix deployed."
EOF

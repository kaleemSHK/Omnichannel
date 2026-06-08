#!/usr/bin/env bash
# Deploy dynamic billing (TRD TR-42–45): bootstrap subscription, usage, invoices, plans.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${BLINKONE_HOST:-root@204.168.137.104}"
REMOTE="${BLINKONE_REMOTE:-/opt/blinkone}"
SSH_OPTS=(-o BatchMode=yes -o StrictHostKeyChecking=accept-new)

BACKEND=(
  services/billing/lib/billing-repo.js
  services/billing/src/server.js
)

FRONTEND=(
  frontend/src/components/billing/BillingWorkspace.tsx
  frontend/src/components/billing/NoPlanBanner.tsx
  frontend/src/components/billing/UpgradePlanModal.tsx
  frontend/src/lib/hooks/useBilling.ts
  frontend/src/lib/api/billing.ts
  frontend/src/lib/utils/billing.ts
)

echo "Syncing dynamic billing to ${HOST}…"
for f in "${BACKEND[@]}" "${FRONTEND[@]}"; do
  scp "${SSH_OPTS[@]}" "$ROOT/$f" "${HOST}:${REMOTE}/$f"
done

ssh "${SSH_OPTS[@]}" "$HOST" bash -s <<EOF
set -euo pipefail
cd ${REMOTE}
docker compose build billing 2>/dev/null || docker compose build billing
docker compose up -d billing
sleep 2
docker compose ps billing
cd frontend
npm run build
pm2 restart blinkone-frontend
echo "Dynamic billing deployed."
EOF

#!/usr/bin/env bash
# Deploy tenant isolation + feature-gated UI.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${BLINKONE_HOST:-root@204.168.137.104}"
REMOTE="${BLINKONE_REMOTE:-/opt/blinkone}"
SSH_OPTS=(-o BatchMode=yes -o StrictHostKeyChecking=accept-new)

BACKEND=(
  services/_shared/lib/tenant-id.js
  services/tenant/lib/repo.js
  services/tenant/src/server.js
  services/escalation/lib/escalation-repo.js
  services/integration/src/server.js
  services/tickets/lib/tenant.js
  gateway/src/index.js
  gateway/src/tenant-features.js
)

FRONTEND=(
  frontend/src/lib/store/features.ts
  frontend/src/lib/store/auth.ts
  frontend/src/lib/features/access.ts
  frontend/src/lib/api/tenant-features.ts
  frontend/src/lib/api/auth.ts
  frontend/src/lib/hooks/useTenantFeatures.ts
  frontend/src/lib/hooks/useTickets.ts
  frontend/src/components/layout/IconSidebar.tsx
  frontend/src/components/layout/RoleGuard.tsx
  frontend/src/components/settings/SettingsNav.tsx
)

echo "Syncing tenant isolation + feature UI to ${HOST}…"
for f in "${BACKEND[@]}" "${FRONTEND[@]}"; do
  scp "${SSH_OPTS[@]}" "$ROOT/$f" "${HOST}:${REMOTE}/$f"
done

ssh "${SSH_OPTS[@]}" "$HOST" bash -s <<EOF
set -euo pipefail
cd ${REMOTE}
docker compose build gateway tenant escalation integration tickets 2>/dev/null || true
docker compose up -d gateway tenant escalation integration tickets 2>/dev/null || true
cd frontend
npm run build
pm2 restart blinkone-frontend
echo "Tenant isolation + feature UI deployed."
EOF

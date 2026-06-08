#!/usr/bin/env bash
# Deploy tenant-scoped settings + Chatwoot-parity inbox wizard.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${BLINKONE_HOST:-root@204.168.137.104}"
REMOTE="${BLINKONE_REMOTE:-/opt/blinkone}"
SSH_OPTS=(-o BatchMode=yes -o StrictHostKeyChecking=accept-new)

BACKEND=(services/platform/src/server.js)

FRONTEND=(
  frontend/src/lib/hooks/useTenantScope.ts
  frontend/src/lib/api/platform-settings.ts
  frontend/src/lib/api/inboxes.ts
  frontend/src/hooks/useInboxAdmin.ts
  frontend/src/components/settings/inbox/InboxCreateWizard.tsx
  frontend/src/components/settings/inbox/ChannelConfigFields.tsx
  frontend/src/components/settings/inbox/InboxCard.tsx
  frontend/src/components/settings/inbox/InboxWidgetEmbed.tsx
  frontend/src/components/settings/inbox/InboxWizardAgentPicker.tsx
  frontend/src/components/settings/RecordingSection.tsx
  frontend/src/components/settings/VoiceSection.tsx
  frontend/src/components/settings/TelephonySection.tsx
  frontend/src/components/settings/ACWSection.tsx
  frontend/src/components/settings/AgentScriptsSection.tsx
  frontend/src/components/settings/CampaignPanel.tsx
  frontend/src/components/settings/TicketFieldsSettings.tsx
  frontend/src/components/settings/CRMConnectorsPanel.tsx
  frontend/src/components/settings/IntegrationsSection.tsx
  frontend/src/components/settings/SkillsManagerSection.tsx
)

echo "Syncing settings + inbox to ${HOST}…"
for f in "${BACKEND[@]}" "${FRONTEND[@]}"; do
  scp "${SSH_OPTS[@]}" "$ROOT/$f" "${HOST}:${REMOTE}/$f"
done

ssh "${SSH_OPTS[@]}" "$HOST" bash -s <<EOF
set -euo pipefail
cd ${REMOTE}
docker compose build platform 2>/dev/null || docker compose build platform
docker compose up -d platform
cd frontend
npm run build
pm2 restart blinkone-frontend
echo "Settings + inbox deployed."
EOF

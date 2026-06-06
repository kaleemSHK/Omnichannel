#!/usr/bin/env bash
# Add FEATURE_FAILOPEN to calls service on demo server
set -euo pipefail
COMPOSE="${1:-/opt/blinkone/docker-compose.yml}"
if grep -q 'FEATURE_FAILOPEN' "$COMPOSE"; then
  echo "FEATURE_FAILOPEN already in compose"
else
  sed -i '/CHATWOOT_BOT_TOKEN:/a\      TENANT_URL: http://tenant:8802\n      TENANT_TOKEN: ${TENANT_TOKEN:-${PLATFORM_TOKEN}}\n      FEATURE_FAILOPEN: ${FEATURE_FAILOPEN:-1}' "$COMPOSE"
  echo "Patched $COMPOSE"
fi

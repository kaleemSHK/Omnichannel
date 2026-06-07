#!/usr/bin/env bash
set -euo pipefail
cd /opt/blinkone
ESC_TOKEN=$(grep '^ESCALATION_TOKEN=' .env | cut -d= -f2-)
docker compose exec -T escalation wget -qO- \
  --header="Authorization: Bearer ${ESC_TOKEN}" \
  --header="x-blinkone-tenant-id: 1" \
  http://127.0.0.1:8797/v1/rulesets 2>&1 | head -c 800
echo ""

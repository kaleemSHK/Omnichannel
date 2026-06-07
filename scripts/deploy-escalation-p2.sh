#!/usr/bin/env bash
set -euo pipefail
cd /opt/blinkone
docker compose build escalation integration
docker compose up -d escalation integration
cd frontend && npm run build && pm2 restart blinkone-frontend
echo "P2 escalation delete + conversation timers deployed."

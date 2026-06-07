#!/usr/bin/env bash
set -euo pipefail
cd /opt/blinkone
docker compose build escalation
docker compose up -d escalation
cd frontend && npm run build && pm2 restart blinkone-frontend
echo "P1 escalation edit + history deployed."

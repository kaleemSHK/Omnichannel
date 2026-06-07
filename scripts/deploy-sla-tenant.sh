#!/usr/bin/env bash
set -euo pipefail
cd /opt/blinkone
docker compose build sla
docker compose up -d sla
cd frontend && npm run build && pm2 restart blinkone-frontend
echo "SLA tenant isolation deployed."

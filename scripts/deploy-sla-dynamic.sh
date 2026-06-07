#!/usr/bin/env bash
set -euo pipefail
cd /opt/blinkone
bash scripts/enable-sla-prod.sh
docker compose exec -T postgres_app psql -U app -d blinkone_app < scripts/sql/seed-demo-sla.sql
docker compose build sla
docker compose up -d sla
cd frontend && npm run build && pm2 restart blinkone-frontend
echo "Dynamic SLA deployed."

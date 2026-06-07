#!/usr/bin/env bash
set -euo pipefail
cd /opt/blinkone
cat scripts/sql/seed-demo-sla.sql | docker compose exec -T postgres_app psql -U app -d blinkone_app -v ON_ERROR_STOP=1

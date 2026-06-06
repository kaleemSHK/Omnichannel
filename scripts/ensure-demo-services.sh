#!/usr/bin/env bash
# Start sidecars required by the Next.js UI (platform, tenant, ai, gateway).
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose up -d gateway platform tenant ai postgres_app
echo "Waiting for health…"
sleep 5
docker compose ps gateway platform tenant ai

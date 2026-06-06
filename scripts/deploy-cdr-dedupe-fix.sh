#!/usr/bin/env bash
# Fix duplicate CDR rows + caller name in call history.
set -euo pipefail
cd /opt/blinkone

echo "=== rebuild calls + routing ==="
docker compose build calls routing
docker compose up -d --force-recreate calls routing

echo "=== rebuild frontend ==="
cd frontend
pm2 stop blinkone-frontend || true
npm run build
pm2 restart blinkone-frontend --update-env

echo "=== done ==="

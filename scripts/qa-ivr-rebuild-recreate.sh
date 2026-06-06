#!/usr/bin/env bash
set -euo pipefail
cd /opt/blinkone

echo "=== rebuild ivr image (bakes in flow-repo UUID guard + server.js try/catch) ==="
docker compose build ivr

echo
echo "=== recreate ivr container (picks up FEATURE_FAILOPEN=1 + TENANT_TOKEN from .env) ==="
docker compose up -d --force-recreate ivr

echo
echo "=== wait for health ==="
sleep 5
docker compose ps ivr

echo
echo "=== verify env now present in running container ==="
docker compose exec -T ivr printenv 2>/dev/null \
  | grep -Ei 'FEATURE_FAILOPEN|TENANT_TOKEN' \
  | sed -E 's/(TOKEN=).*/\1<redacted>/'

echo
echo "=== verify crash-fix present in image (UUID guard) ==="
docker compose exec -T ivr sh -lc "grep -c UUID_RE lib/flow-repo.js 2>/dev/null || grep -rc UUID_RE /app 2>/dev/null | head -1"

echo
echo "=== recent ivr logs ==="
docker compose logs --tail=20 ivr 2>&1 | tail -20
echo DONE-IVR-RECREATE

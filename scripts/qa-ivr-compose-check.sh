#!/usr/bin/env bash
set -uo pipefail
cd /opt/blinkone

echo "=== compose files present ==="
ls -la docker-compose*.yml 2>&1

echo
echo "=== resolved env for ivr service (compose config) ==="
docker compose config 2>/dev/null \
  | awk '/^  ivr:/{f=1} f&&/^  [a-z]/&&!/^  ivr:/{f=0} f' \
  | grep -Ei 'FEATURE_FAILOPEN|TENANT_TOKEN|TENANT_URL|PLATFORM_TOKEN' \
  | sed -E 's/(TOKEN:?[[:space:]]*).*/\1<redacted>/'

echo
echo "=== .env feature/token lines ==="
grep -Ei '^(FEATURE_FAILOPEN|TENANT_TOKEN|PLATFORM_TOKEN)=' .env | sed -E 's/(TOKEN=).*/\1<redacted>/' || echo "(none)"

#!/usr/bin/env bash
set -euo pipefail
cd /opt/blinkone

OVERRIDE=docker-compose.override.yml
STAMP=$(date +%Y%m%d-%H%M%S)
cp "$OVERRIDE" "${OVERRIDE}.bak-${STAMP}"
echo "Backed up override -> ${OVERRIDE}.bak-${STAMP}"

if grep -q 'FEATURE_FAILOPEN' "$OVERRIDE"; then
  echo "ivr feature env already present in override; skipping append."
else
  cat >> "$OVERRIDE" <<'YAML'

  ivr:
    environment:
      TENANT_URL: http://tenant:8802
      TENANT_TOKEN: ${TENANT_TOKEN:-${PLATFORM_TOKEN}}
      FEATURE_FAILOPEN: ${FEATURE_FAILOPEN:-1}
YAML
  echo "Appended ivr feature env to override."
fi

echo
echo "=== validate merged compose for ivr ==="
docker compose config 2>/dev/null \
  | awk '/^  ivr:/{f=1} f&&/^  [a-z][a-z_-]*:/&&!/^  ivr:/{exit} f{print}' \
  | grep -Ei 'FEATURE_FAILOPEN|TENANT_TOKEN|TENANT_URL' \
  | sed -E 's/(TOKEN:?[[:space:]]*).*/\1<redacted>/'

echo
echo "=== recreate ivr ==="
docker compose up -d --force-recreate ivr
sleep 5

echo
echo "=== verify env in running container ==="
docker compose exec -T ivr printenv 2>/dev/null \
  | grep -Ei 'FEATURE_FAILOPEN|TENANT_TOKEN|TENANT_URL' \
  | sed -E 's/(TOKEN=).*/\1<redacted>/' || echo "STILL MISSING"

echo
echo "=== ivr logs tail ==="
docker compose logs --tail=15 ivr 2>&1 | tail -15
echo DONE-IVR-FEATURE-ENABLE

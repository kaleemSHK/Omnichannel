#!/usr/bin/env bash
set -uo pipefail
cd /opt/blinkone

echo "=== tenant_features (tenant 1) ==="
PGPASSWORD=$(grep '^APP_DB_PASSWORD=' .env | cut -d= -f2-) \
  docker compose exec -T -e PGPASSWORD postgres_app \
  psql -U app -d blinkone_app -c \
  "SELECT tenant_id, feature_key, enabled FROM tenant_features WHERE tenant_id='1' ORDER BY feature_key;" 2>&1 | head -40

echo
echo "=== tenants row (tenant 1) ==="
PGPASSWORD=$(grep '^APP_DB_PASSWORD=' .env | cut -d= -f2-) \
  docker compose exec -T -e PGPASSWORD postgres_app \
  psql -U app -d blinkone_app -c \
  "SELECT id, billing_plan_id, status FROM tenants WHERE id='1';" 2>&1 | head -20

echo
echo "=== IVR feature-related env ==="
docker compose exec -T ivr printenv 2>/dev/null \
  | grep -Ei 'FEATURE_FAILOPEN|CALLING_PSTN_ENABLED|TENANT_TOKEN|PLATFORM_TOKEN|TENANT_URL' \
  | sed -E 's/(TOKEN=).*/\1<redacted>/'

echo
echo "=== calls feature-related env ==="
docker compose exec -T calls printenv 2>/dev/null \
  | grep -Ei 'FEATURE_FAILOPEN|CALLING_PSTN_ENABLED'

echo
echo "=== IVR -> tenant service feature fetch (as IVR sees it) ==="
TT=$(docker compose exec -T ivr printenv TENANT_TOKEN 2>/dev/null | tr -d '\r')
[ -z "$TT" ] && TT=$(docker compose exec -T ivr printenv PLATFORM_TOKEN 2>/dev/null | tr -d '\r')
TU=$(docker compose exec -T ivr printenv TENANT_URL 2>/dev/null | tr -d '\r')
[ -z "$TU" ] && TU="http://tenant:8802"
echo "TENANT_URL=$TU  token_present=$([ -n "$TT" ] && echo yes || echo no)"
docker compose exec -T ivr sh -lc "wget -qO- --header='Authorization: Bearer $TT' '$TU/v1/tenants/1' 2>/dev/null || curl -s -H 'Authorization: Bearer $TT' '$TU/v1/tenants/1'" 2>&1 | head -c 1200
echo

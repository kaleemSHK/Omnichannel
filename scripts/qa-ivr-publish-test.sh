#!/usr/bin/env bash
set -uo pipefail
cd /opt/blinkone

IVR_TOKEN=$(grep '^IVR_TOKEN=' .env | cut -d= -f2-)

echo "=== health (from tenant container -> http://ivr:8795) ==="
docker compose exec -T tenant sh -lc "wget -qO- 'http://ivr:8795/healthz' 2>&1 || wget -qO- 'http://ivr:8795/readyz' 2>&1" | head -c 300
echo

echo
echo "=== list flows (tenant 1) via ivr service name ==="
LIST=$(docker compose exec -T tenant sh -lc "wget -qO- --header='Authorization: Bearer $IVR_TOKEN' --header='X-Tenant-Id: 1' 'http://ivr:8795/v1/flows' 2>&1")
echo "$LIST" | head -c 900
echo

FLOW_ID=$(echo "$LIST" | grep -oE '"id":"[0-9a-f-]{36}"' | head -1 | cut -d'"' -f4)
echo
echo "first flow id = ${FLOW_ID:-<none>}"

if [ -z "$FLOW_ID" ]; then
  echo "No UUID flow found; aborting publish test."
  exit 0
fi

echo
echo "=== publish flow $FLOW_ID (expect 200, NOT 403 FEATURE_DISABLED) ==="
docker compose exec -T tenant sh -lc "wget -qO- --post-data='{}' --header='Content-Type: application/json' --header='Authorization: Bearer $IVR_TOKEN' --header='X-Tenant-Id: 1' 'http://ivr:8795/v1/flows/$FLOW_ID/publish' 2>&1" | head -c 1200
echo
echo DONE-PUBLISH-TEST

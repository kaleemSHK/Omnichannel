#!/usr/bin/env bash
set -euo pipefail
cd /opt/blinkone

echo "=== rebuild + recreate ivr ==="
docker compose build ivr >/dev/null 2>&1 && echo "built"
docker compose up -d --force-recreate ivr
sleep 5
docker compose ps ivr

IVR_TOKEN=$(grep '^IVR_TOKEN=' .env | cut -d= -f2-)

echo
echo "=== list flows (default tenant resolves via internal token) ==="
LIST=$(docker compose exec -T tenant sh -lc "wget -qO- --header='Authorization: Bearer $IVR_TOKEN' 'http://ivr:8795/v1/flows' 2>&1")
FLOW_ID=$(echo "$LIST" | grep -oE '"id":"[0-9a-f-]{36}"' | head -1 | cut -d'"' -f4)
echo "flow id = ${FLOW_ID:-<none>}"
[ -z "$FLOW_ID" ] && { echo "no flow"; exit 1; }

echo
echo "=== POST /v1/flows/$FLOW_ID/publish (expect 200 + flow JSON, NOT 403/404) ==="
docker compose exec -T tenant sh -lc "wget -qO- --post-data='{}' --header='Content-Type: application/json' --header='Authorization: Bearer $IVR_TOKEN' 'http://ivr:8795/v1/flows/$FLOW_ID/publish' 2>&1" | head -c 1000
echo
echo
echo "=== versions after publish (should show a new 'Published' version) ==="
docker compose exec -T tenant sh -lc "wget -qO- --header='Authorization: Bearer $IVR_TOKEN' 'http://ivr:8795/v1/flows/$FLOW_ID/versions' 2>&1" | head -c 600
echo
echo DONE-PUBLISH-DEPLOY

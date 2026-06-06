#!/bin/bash
set -euo pipefail
CID=$(docker compose -f /opt/blinkone/docker-compose.yml exec -T postgres_app psql -U app -d blinkone_app -tAc \
  "SELECT id FROM call_sessions WHERE tenant_id='1' ORDER BY created_at DESC LIMIT 1")
if [ -z "$CID" ]; then echo "no calls"; exit 1; fi
docker compose -f /opt/blinkone/docker-compose.yml exec -T calls wget -qO- \
  --header='Content-Type: application/json' \
  --header='Authorization: Bearer blinkone-calls-token' \
  --header='X-Blinkone-Tenant-Id: 1' \
  --method=PATCH \
  --body-data="{\"outcome\":\"resolved\",\"metadata\":{\"notes\":\"test wrap-up\"}}" \
  "http://127.0.0.1:8792/v1/calls/${CID}" 2>&1 || \
docker compose -f /opt/blinkone/docker-compose.yml exec -T calls node -e "
fetch('http://127.0.0.1:8792/v1/calls/${CID}',{
  method:'PATCH',
  headers:{'Content-Type':'application/json','Authorization':'Bearer blinkone-calls-token','X-Blinkone-Tenant-Id':'1'},
  body:JSON.stringify({outcome:'resolved',metadata:{notes:'test wrap-up'}})
}).then(r=>r.text()).then(console.log)
"
echo

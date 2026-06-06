#!/usr/bin/env bash
set -euo pipefail
cd /opt/blinkone

TICKET_TOKEN=$(grep "^TICKET_TOKEN=" .env | cut -d= -f2-)
SLA_TOKEN=$(grep "^SLA_TOKEN=" .env | cut -d= -f2-)

echo "=== Seeding tickets ==="
tickets=(
  '{"title":"Cannot login to portal","status":"open","priority":"high","customerName":"Ahmed Khan","customerEmail":"ahmed.khan@gmail.com","department":"support","chatwootAccountId":1}'
  '{"title":"Invoice not received for April","status":"open","priority":"medium","customerName":"Sara Malik","customerEmail":"sara.malik@yahoo.com","department":"billing","chatwootAccountId":1}'
  '{"title":"Product damaged on delivery","status":"in-progress","priority":"urgent","customerName":"Hina Qureshi","customerEmail":"hina.q@yahoo.com","department":"support","chatwootAccountId":1}'
  '{"title":"Request for bulk pricing","status":"open","priority":"low","customerName":"Zainab Raza","customerEmail":"zainab.r@gmail.com","department":"sales","chatwootAccountId":1}'
  '{"title":"Payment gateway timeout error","status":"resolved","priority":"high","customerName":"Bilal Hussain","customerEmail":"bilal.h@gmail.com","department":"support","chatwootAccountId":1}'
  '{"title":"Change account email address","status":"open","priority":"medium","customerName":"Kamran Sheikh","customerEmail":"kamran.s@gmail.com","department":"support","chatwootAccountId":1}'
  '{"title":"Upgrade to Enterprise plan","status":"in-progress","priority":"medium","customerName":"Fatima Zahra","customerEmail":"fatima.z@hotmail.com","department":"sales","chatwootAccountId":1}'
  '{"title":"API integration not working","status":"open","priority":"urgent","customerName":"Nadia Farooq","customerEmail":"nadia.f@gmail.com","department":"support","chatwootAccountId":1}'
)
for ticket in "${tickets[@]}"; do
  resp=$(curl -s -w "\n%{http_code}" -X POST http://127.0.0.1:8791/v1/tickets \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TICKET_TOKEN}" \
    -d "${ticket}")
  code=$(echo "${resp}" | tail -1)
  body=$(echo "${resp}" | sed '$d')
  title=$(echo "${body}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('title', d.get('error',{}).get('message', '?')))" 2>/dev/null || echo "${body:0:60}")
  echo "  HTTP ${code} - ${title}"
done

echo "=== Seeding SLA policies ==="
for policy in \
  '{"name":"Gold - 1hr response","firstResponseMinutes":60,"resolveMinutes":240}' \
  '{"name":"Silver - 4hr response","firstResponseMinutes":240,"resolveMinutes":480}' \
  '{"name":"Bronze - 24hr response","firstResponseMinutes":1440,"resolveMinutes":4320}'; do
  resp=$(curl -s -w "\n%{http_code}" -X POST http://127.0.0.1:8796/v1/policies \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${SLA_TOKEN}" \
    -H "X-Tenant-Id: 1" \
    -d "${policy}")
  code=$(echo "${resp}" | tail -1)
  body=$(echo "${resp}" | sed '$d')
  name=$(echo "${body}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('name', d.get('error',{}).get('message', '?')))" 2>/dev/null || echo "?")
  echo "  HTTP ${code} - ${name}"
done

echo "=== Health checks ==="
curl -sf http://127.0.0.1:8791/health && echo " tickets OK" || echo " tickets FAIL"
curl -sf http://127.0.0.1:8796/health && echo " sla OK" || echo " sla FAIL"
curl -sf http://127.0.0.1:8787/health && echo " gateway OK" || echo " gateway FAIL"

echo "Done."

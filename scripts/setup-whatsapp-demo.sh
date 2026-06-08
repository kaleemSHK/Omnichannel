#!/usr/bin/env bash
set -euo pipefail
cd /opt/blinkone
TOKEN=$(grep ^WHATSAPP_ACCESS_TOKEN= .env | cut -d= -f2-)
CW=$(grep ^CHATWOOT_API_ACCESS_TOKEN= .env | cut -d= -f2-)

RESP=$(docker exec blinkone-chatwoot-1 wget -qO- \
  --header="api_access_token: $CW" \
  --header="Content-Type: application/json" \
  --post-data="{\"name\":\"WhatsApp Demo\",\"channel\":{\"type\":\"whatsapp\",\"phone_number\":\"+15556712440\",\"provider\":\"whatsapp_cloud\",\"provider_config\":{\"api_key\":\"$TOKEN\",\"phone_number_id\":\"1236816386176073\",\"business_account_id\":\"2013941233330747\"}}}" \
  http://127.0.0.1:3000/api/v1/accounts/1/inboxes 2>/dev/null || echo '{}')

INBOX_ID=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null || true)
if [ -z "$INBOX_ID" ]; then
  INBOX_ID=4
  echo "Using existing inbox id 4"
else
  echo "Created inbox id $INBOX_ID"
fi

grep -v '^WHATSAPP_INBOX_ID=' .env > /tmp/blinkone-wa.env || true
grep -v '^WHATSAPP_INBOX_ID=' /tmp/blinkone-wa.env > /tmp/blinkone-wa2.env 2>/dev/null || cp .env /tmp/blinkone-wa2.env
echo "WHATSAPP_INBOX_ID=$INBOX_ID" >> /tmp/blinkone-wa2.env
mv /tmp/blinkone-wa2.env .env

docker compose up -d whatsapp-calls
sleep 3
CT=$(grep ^CALLS_TOKEN= .env | cut -d= -f2-)
docker exec blinkone-whatsapp-calls-1 wget -qO- --header="Authorization: Bearer $CT" http://127.0.0.1:8803/v1/config
echo
curl -s "http://127.0.0.1:8787/api/whatsapp-calls/v1/webhooks/meta?hub.mode=subscribe&hub.verify_token=blinkone_wh_2026&hub.challenge=ok123" || true
echo

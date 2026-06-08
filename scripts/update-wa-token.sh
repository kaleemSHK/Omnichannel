#!/usr/bin/env bash
set -euo pipefail
cd /opt/blinkone
TOKEN=$(grep ^WHATSAPP_ACCESS_TOKEN= .env | cut -d= -f2-)
CW=$(grep ^CHATWOOT_API_ACCESS_TOKEN= .env | cut -d= -f2-)
INBOX=$(grep ^WHATSAPP_INBOX_ID= .env | cut -d= -f2-)
CT=$(grep ^CALLS_TOKEN= .env | cut -d= -f2-)

docker exec blinkone-whatsapp-calls-1 wget -qO- \
  --header="Authorization: Bearer $CT" \
  http://127.0.0.1:8803/v1/config
echo

# Update Chatwoot WhatsApp inbox provider token
docker exec blinkone-chatwoot-1 wget -qO- \
  --header="api_access_token: $CW" \
  --header="Content-Type: application/json" \
  --method=PATCH \
  --body-data="{\"channel\":{\"provider_config\":{\"api_key\":\"$TOKEN\",\"phone_number_id\":\"1236816386176073\",\"business_account_id\":\"2013941233330747\"}}}" \
  "http://127.0.0.1:3000/api/v1/accounts/1/inboxes/$INBOX" 2>/dev/null | head -c 300 || echo inbox_patch_done
echo

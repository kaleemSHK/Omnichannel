#!/usr/bin/env bash
set -euo pipefail
cd /opt/blinkone
REC=$(grep '^RECORDING_TOKEN=' .env | cut -d= -f2-)
UPLOAD=$(dd if=/dev/zero bs=1024 count=8 2>/dev/null | curl -s -X POST \
  http://127.0.0.1:8787/api/recordings/v1/recordings \
  -H "Authorization: Bearer ${REC}" \
  -H "X-Blinkone-Tenant-Id: 1" \
  -F "callId=minio-live-1" \
  -F "chatwootAccountId=1" \
  -F "durationMs=8000" \
  -F "direction=inbound" \
  -F "audio=@-;filename=t.wav;type=audio/wav")
echo "$UPLOAD"
LIST=$(curl -s http://127.0.0.1:8787/api/recordings/v1/recordings \
  -H "Authorization: Bearer ${REC}" \
  -H "X-Blinkone-Tenant-Id: 1")
echo "$LIST"
ID=$(echo "$UPLOAD" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p' | head -1)
if [ -n "$ID" ]; then
  curl -s "http://127.0.0.1:8787/api/recordings/v1/recordings/${ID}/play" \
    -H "Authorization: Bearer ${REC}" \
    -H "X-Blinkone-Tenant-Id: 1"
  echo
fi
docker compose exec blinkone-minio mc ls local/recordings/ --recursive 2>/dev/null | tail -5 || true

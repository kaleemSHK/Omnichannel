#!/usr/bin/env bash
set -euo pipefail
cd /opt/blinkone
REC=$(grep '^RECORDING_TOKEN=' .env | cut -d= -f2-)
curl -s -o /tmp/rec-stream.wav -w "%{http_code}" \
  "http://127.0.0.1:8787/api/recordings/v1/recordings/rec-2/stream" \
  -H "Authorization: Bearer ${REC}" \
  -H "X-Blinkone-Tenant-Id: 1"
echo
ls -la /tmp/rec-stream.wav

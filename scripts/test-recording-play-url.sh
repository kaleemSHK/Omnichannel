#!/usr/bin/env bash
set -euo pipefail
cd /opt/blinkone
REC=$(grep '^RECORDING_TOKEN=' .env | cut -d= -f2-)
curl -s "http://127.0.0.1:8787/api/recordings/v1/recordings/rec-2/play" \
  -H "Authorization: Bearer ${REC}" \
  -H "X-Blinkone-Tenant-Id: 1"
echo

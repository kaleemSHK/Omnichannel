#!/bin/bash
set -euo pipefail
CID="test-acd-$(date +%s)"
docker compose -f /opt/blinkone/docker-compose.yml exec -T calls \
  wget -qO- \
  --header='Content-Type: application/json' \
  --header='Authorization: Bearer blinkone-calls-token' \
  --header='X-Blinkone-Tenant-Id: 1' \
  --post-data="{\"callId\":\"${CID}\",\"agentId\":\"1\",\"queueKey\":\"support\",\"transport\":\"webrtc\"}" \
  http://127.0.0.1:8792/v1/internal/calls/acd-assign
echo

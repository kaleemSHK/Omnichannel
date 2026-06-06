#!/usr/bin/env bash
cd /opt/blinkone
echo "AI env:"
docker compose exec -T ai printenv MINIO_STUB PIPER_STUB GOOGLE_STT_STUB 2>/dev/null || true
echo "Status:"
AI_TOKEN="$(grep '^AI_TOKEN=' .env | cut -d= -f2-)"
curl -sf -H "Authorization: Bearer ${AI_TOKEN}" -H "X-Blinkone-Tenant-Id: 1" \
  http://127.0.0.1:8787/api/ai/v1/voicebot/status | python3 -m json.tool

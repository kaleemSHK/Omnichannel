#!/usr/bin/env bash
set -euo pipefail
cd /opt/blinkone
AI=$(grep '^AI_TOKEN=' .env | cut -d= -f2-)
curl -s http://127.0.0.1:8787/api/ai/v1/rag/collections \
  -H "Authorization: Bearer ${AI}" \
  -H "X-Blinkone-Tenant-Id: 1"
echo

#!/bin/bash
# Quick test: post incoming message to Chatwoot conversation
set -euo pipefail
TOKEN="${1:-zAjRaYLuSRfA3FZjF3dPYv4H}"
CONV="${2:-59}"
curl -s -w "\nHTTP:%{http_code}\n" -X POST \
  "http://chatwoot:3000/api/v1/accounts/1/conversations/${CONV}/messages" \
  -H "api_access_token: ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"content\":\"test from script\",\"message_type\":\"incoming\",\"content_type\":\"text\",\"source_id\":\"wamid.test123\"}"

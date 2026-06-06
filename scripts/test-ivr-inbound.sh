#!/usr/bin/env bash
set -euo pipefail
cd /opt/blinkone
curl -s -w "\nHTTP:%{http_code}\n" -X POST "http://127.0.0.1:8787/api/ivr/v1/ivr/inbound" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "CallSid=smoke-test&From=%2B96890000000&To=%2B19143038893"

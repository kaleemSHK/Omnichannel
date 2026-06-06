#!/usr/bin/env bash
set -euo pipefail
TOKEN=$(curl -sf -X POST http://127.0.0.1:3000/auth/sign_in \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@blinksone.com","password":"Demo@2026!"}' \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["access_token"])')

URL="https://app.blinksone.com/_cw/api/v1/accounts/1/conversations?status=open"

echo "Without header:"
curl -sk -o /dev/null -w "HTTP %{http_code}\n" "$URL"

echo "With api_access_token (underscore):"
curl -sk -o /tmp/h1.json -w "HTTP %{http_code}\n" -H "api_access_token: ${TOKEN}" "$URL"
head -c 120 /tmp/h1.json; echo

echo "Direct to Next :3001 with underscore header:"
curl -sk -o /tmp/h2.json -w "HTTP %{http_code}\n" -H "api_access_token: ${TOKEN}" \
  "http://127.0.0.1:3001/_cw/api/v1/accounts/1/conversations?status=open"
python3 -c 'import json; d=json.load(open("/tmp/h2.json")); print("count", len(d["data"]["payload"]))'

echo "Via nginx http://127.0.0.1 (port 443) with Host app.blinksone.com:"
curl -sk -o /tmp/h3.json -w "HTTP %{http_code}\n" -H "Host: app.blinksone.com" -H "api_access_token: ${TOKEN}" \
  "https://127.0.0.1/_cw/api/v1/accounts/1/conversations?status=open"
head -c 120 /tmp/h3.json; echo

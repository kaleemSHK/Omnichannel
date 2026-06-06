#!/usr/bin/env bash
set -uo pipefail
cd /opt/blinkone
CALLS_TOKEN=$(grep '^CALLS_TOKEN=' .env | cut -d= -f2-)
docker compose exec -T calls sh -lc "wget -qO- --header='Authorization: Bearer ${CALLS_TOKEN}' --header='X-Blinkone-Tenant-Id: 1' 'http://127.0.0.1:8792/v1/cdr?limit=5'" | head -c 1000
echo

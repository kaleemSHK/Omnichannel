#!/usr/bin/env bash
set -uo pipefail

echo "=== frontend env files ==="
ls -la /opt/blinkone/frontend/.env* 2>/dev/null || echo "no frontend .env files"

echo
echo "=== SIP/WS/CHATWOOT lines in frontend env files ==="
grep -HnE 'NEXT_PUBLIC_SIP|NEXT_PUBLIC_CHATWOOT_URL|NEXT_PUBLIC_WS_URL' /opt/blinkone/frontend/.env* 2>/dev/null || echo "none in frontend .env*"

echo
echo "=== root .env SIP/WS lines ==="
grep -nE 'NEXT_PUBLIC_SIP|NEXT_PUBLIC_CHATWOOT_URL|NEXT_PUBLIC_WS_URL' /opt/blinkone/.env 2>/dev/null || echo "none in /opt/blinkone/.env"

echo
echo "=== frontend package.json scripts ==="
grep -nE '"(build|start|deploy|build:.*)":' /opt/blinkone/frontend/package.json 2>/dev/null || true

echo
echo "=== deploy scripts referencing frontend build ==="
ls -la /opt/blinkone/scripts/ 2>/dev/null | grep -iE 'front|deploy|build' || true

echo
echo "=== pm2 status ==="
pm2 list 2>/dev/null | head -20 || echo "pm2 not found"
echo "DONE"

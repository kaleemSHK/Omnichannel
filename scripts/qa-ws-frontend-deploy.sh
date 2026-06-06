#!/usr/bin/env bash
set -euo pipefail
cd /opt/blinkone/frontend

update_env () {
  local f="$1"
  [ -f "$f" ] || return 0
  cp "$f" "${f}.bak-$(date +%Y%m%d-%H%M%S)"
  # cable WS -> ws subdomain
  if grep -q '^NEXT_PUBLIC_WS_URL=' "$f"; then
    sed -i 's#^NEXT_PUBLIC_WS_URL=.*#NEXT_PUBLIC_WS_URL=wss://ws.blinksone.com/cable#' "$f"
  else
    echo 'NEXT_PUBLIC_WS_URL=wss://ws.blinksone.com/cable' >> "$f"
  fi
  # routing/wallboard WS host
  if grep -q '^NEXT_PUBLIC_WS_HOST=' "$f"; then
    sed -i 's#^NEXT_PUBLIC_WS_HOST=.*#NEXT_PUBLIC_WS_HOST=ws.blinksone.com#' "$f"
  else
    echo 'NEXT_PUBLIC_WS_HOST=ws.blinksone.com' >> "$f"
  fi
  echo "--- $f (after) ---"
  grep -nE 'NEXT_PUBLIC_WS_URL|NEXT_PUBLIC_WS_HOST' "$f"
}

echo "=== update env files ==="
update_env .env.production
update_env .env.local

echo
echo "=== rebuild frontend ==="
npm run build
pm2 restart blinkone-frontend
echo FRONTEND-WS-DEPLOYED

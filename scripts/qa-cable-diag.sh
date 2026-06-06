#!/usr/bin/env bash
set -uo pipefail
cd /opt/blinkone

echo "=== nginx /cable + /ws location blocks ==="
for f in /etc/nginx/sites-enabled/* /etc/nginx/conf.d/*; do
  [ -f "$f" ] || continue
  if grep -qE 'cable|/ws|blinksone' "$f"; then
    echo "--- $f ---"
    grep -nE 'location|cable|proxy_pass|Upgrade|upgrade|server_name|/ws' "$f" | head -80
  fi
done

echo
echo "=== chatwoot container status ==="
docker compose ps chatwoot 2>&1 | tail -3

echo
echo "=== chatwoot cable health (in-container) ==="
docker compose exec -T chatwoot sh -lc "wget -qS -O- 'http://localhost:3000/cable' 2>&1 | head -20" 2>&1 | head -25

echo
echo "=== nginx test config ==="
nginx -t 2>&1 | tail -5
echo DONE-CABLE-DIAG

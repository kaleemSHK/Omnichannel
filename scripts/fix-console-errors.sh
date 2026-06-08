#!/usr/bin/env bash
# Fix browser console noise: tickets 404 + ActionCable WS host.
set -euo pipefail
cd /opt/blinkone

for f in frontend/.env.production frontend/.env.local; do
  [[ -f "$f" ]] || continue
  if grep -q '^NEXT_PUBLIC_WS_URL=' "$f"; then
    sed -i 's#^NEXT_PUBLIC_WS_URL=.*#NEXT_PUBLIC_WS_URL=wss://ws.blinksone.com/cable#' "$f"
  else
    echo 'NEXT_PUBLIC_WS_URL=wss://ws.blinksone.com/cable' >> "$f"
  fi
  if grep -q '^NEXT_PUBLIC_WS_HOST=' "$f"; then
    sed -i 's#^NEXT_PUBLIC_WS_HOST=.*#NEXT_PUBLIC_WS_HOST=ws.blinksone.com#' "$f"
  else
    echo 'NEXT_PUBLIC_WS_HOST=ws.blinksone.com' >> "$f"
  fi
done

docker compose build tickets
docker compose up -d tickets

cd frontend
npm run build
pm2 restart blinkone-frontend

echo "Done — tickets return 200 when unlinked; WS uses ws.blinksone.com"

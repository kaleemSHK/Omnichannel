#!/usr/bin/env bash
# Ensure /api/recordings/* reaches gateway (not Next.js).
set -euo pipefail
CONF=/etc/nginx/sites-enabled/blinkone
if grep -q 'recordings|' "$CONF"; then
  echo "nginx already routes /api/recordings"
else
  sed -i 's/|recording|/|recording|recordings|/' "$CONF"
  echo "patched nginx recordings route"
fi
nginx -t
systemctl reload nginx
echo "nginx reloaded"

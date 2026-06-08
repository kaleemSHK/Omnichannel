#!/bin/bash
# Proxy Chatwoot Vite/packs static assets (required when /app/ dashboard is on BlinkOne domain).
set -euo pipefail
NGINX_CONF="${1:-/etc/nginx/sites-enabled/blinkone}"

add_location() {
  local name="$1"
  if grep -q "location ${name}" "$NGINX_CONF" 2>/dev/null; then
    echo "skip ${name}"
    return
  fi
  local TMP
  TMP=$(mktemp)
  awk -v loc="$name" '
    /location \/app\/ \{/ && !done {
      print "    location " loc " {"
      print "        proxy_pass http://127.0.0.1:3000;"
      print "        proxy_http_version 1.1;"
      print "        proxy_set_header Host $host;"
      print "        proxy_set_header X-Real-IP $remote_addr;"
      print "        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;"
      print "        proxy_set_header X-Forwarded-Proto $scheme;"
      print "    }"
      print ""
      done=1
    }
    { print }
  ' "$NGINX_CONF" > "$TMP"
  mv "$TMP" "$NGINX_CONF"
  echo "added ${name}"
}

add_location '/vite/'
add_location '/packs/'
add_location '/brand-assets/'
nginx -t && systemctl reload nginx
echo "Chatwoot asset routes ready"

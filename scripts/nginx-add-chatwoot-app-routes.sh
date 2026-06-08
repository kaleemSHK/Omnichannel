#!/bin/bash
# Proxy Chatwoot dashboard /app/* on BlinkOne domain (Instagram OAuth error/success pages).
set -euo pipefail
NGINX_CONF="${1:-/etc/nginx/sites-enabled/blinkone}"

if grep -q 'location /app/' "$NGINX_CONF" 2>/dev/null; then
  echo "/app/ route already present"
  exit 0
fi

TMP=$(mktemp)
awk '
  /location ~ \^\/\(api\/v1/ {
    print "    location /app/ {"
    print "        proxy_pass http://127.0.0.1:3000;"
    print "        proxy_http_version 1.1;"
    print "        proxy_set_header Host $host;"
    print "        proxy_set_header X-Real-IP $remote_addr;"
    print "        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;"
    print "        proxy_set_header X-Forwarded-Proto $scheme;"
    print "    }"
    print ""
  }
  { print }
' "$NGINX_CONF" > "$TMP"
cp "$NGINX_CONF" "${NGINX_CONF}.bak.app.$(date +%s)"
mv "$TMP" "$NGINX_CONF"
nginx -t && systemctl reload nginx
echo "Chatwoot /app/ proxy added"

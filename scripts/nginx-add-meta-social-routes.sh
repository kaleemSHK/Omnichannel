#!/bin/bash
# Add Chatwoot Meta social webhook routes to production nginx.
set -euo pipefail

NGINX_CONF="${1:-/etc/nginx/sites-enabled/blinkone}"

if grep -q 'location = /bot' "$NGINX_CONF" 2>/dev/null; then
  echo "Meta social routes already present in $NGINX_CONF"
  exit 0
fi

TMP=$(mktemp)
awk '
  /location ~ \^\/\(api\/v1/ {
    print "    # Meta Messenger + Instagram (Chatwoot native)"
    print "    location = /bot {"
    print "        proxy_pass http://127.0.0.1:3000;"
    print "        proxy_http_version 1.1;"
    print "        proxy_set_header Host $host;"
    print "        proxy_set_header X-Real-IP $remote_addr;"
    print "        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;"
    print "        proxy_set_header X-Forwarded-Proto $scheme;"
    print "    }"
    print "    location /webhooks/instagram {"
    print "        proxy_pass http://127.0.0.1:3000;"
    print "        proxy_http_version 1.1;"
    print "        proxy_set_header Host $host;"
    print "        proxy_set_header X-Real-IP $remote_addr;"
    print "        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;"
    print "        proxy_set_header X-Forwarded-Proto $scheme;"
    print "    }"
    print "    location /instagram/callback {"
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

cp "$NGINX_CONF" "${NGINX_CONF}.bak.$(date +%s)"
mv "$TMP" "$NGINX_CONF"
nginx -t
systemctl reload nginx
echo "Meta social nginx routes added and nginx reloaded."

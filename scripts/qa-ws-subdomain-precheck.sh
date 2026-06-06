#!/usr/bin/env bash
set -uo pipefail

echo "=== this server public IP ==="
curl -s ifconfig.me 2>/dev/null || hostname -I

echo
echo "=== DNS resolution of ws.blinksone.com (must point to THIS server, DNS-only) ==="
getent hosts ws.blinksone.com || nslookup ws.blinksone.com 2>&1 | tail -6

echo
echo "=== existing nginx ssl_certificate lines (what cert does app.blinksone.com use?) ==="
grep -rnE 'ssl_certificate(_key)?' /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ 2>/dev/null | head

echo
echo "=== is the app cert a Cloudflare Origin cert or Let's Encrypt? (issuer) ==="
CERT=$(grep -hoE 'ssl_certificate\s+\S+' /etc/nginx/sites-enabled/blinkone | head -1 | awk '{print $2}' | tr -d ';')
echo "cert file: $CERT"
[ -f "$CERT" ] && openssl x509 -in "$CERT" -noout -issuer -subject -ext subjectAltName 2>/dev/null | head

echo
echo "=== certbot available? existing LE certs ==="
which certbot && certbot certificates 2>/dev/null | grep -E 'Certificate Name|Domains|Expiry' | head -20 || echo "certbot not installed"

echo
echo "=== ufw status (need 80/443 open for HTTP-01 + direct wss) ==="
ufw status 2>/dev/null | grep -E '80|443|Status' | head
echo DONE-WS-PRECHECK

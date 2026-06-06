#!/usr/bin/env bash
set -uo pipefail

echo "=== Host Kamailio registrations (ul.dump) ==="
kamcmd ul.dump 2>/dev/null | head -60 || echo "kamcmd failed"
echo "--- AOR/contact count ---"
kamcmd ul.dump 2>/dev/null | grep -cE 'AOR::|Contact::' || true

echo
echo "=== Which cfg is loaded ==="
ls -l /etc/kamailio/kamailio.cfg
echo "--- head of loaded cfg ---"
head -25 /etc/kamailio/kamailio.cfg

echo
echo "=== nginx /sip + sip.blinksone.com server block ==="
sed -n '1,120p' /etc/nginx/sites-available/blinkone | grep -nE 'server_name|location|proxy_pass|listen|8088|sip|wss|/cable' || true

echo
echo "=== Full SIP env from .env ==="
grep -E 'SIP|ZADARMA|TWILIO|KAMAILIO' /opt/blinkone/.env 2>/dev/null | sed 's/\(PASS[^=]*=\).*/\1<redacted>/I' || true

echo
echo "=== Kamailio WS/WSS listeners (config) ==="
grep -nE 'listen=|tls|ws|wss|8088|8443' /etc/kamailio/kamailio.cfg 2>/dev/null | head -30 || true
echo "DONE"

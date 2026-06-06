#!/usr/bin/env bash
set -uo pipefail

echo "=== systemd kamailio ==="
systemctl status kamailio --no-pager 2>/dev/null | head -15 || echo "no systemd kamailio"
which kamailio kamcmd 2>/dev/null || echo "no kamailio binary on host"

echo
echo "=== Listening ports (SIP/WSS-ish) ==="
ss -lntup 2>/dev/null | grep -E ':5060|:5061|:8443|:7443|:443|:8088|:10000' || echo "no matches"

echo
echo "=== docker-compose services referencing kamailio ==="
grep -rEl 'kamailio' /root/ /opt/ /srv/ 2>/dev/null | head -20 || true

echo
echo "=== nginx sip/ws upstreams ==="
grep -rEn 'kamailio|/ws|/cable|sip|8443|5060' /etc/nginx/ 2>/dev/null | head -40 || echo "none"

echo
echo "=== Frontend built SIP env (pm2/.env) ==="
grep -rEn 'NEXT_PUBLIC_SIP_WSS|NEXT_PUBLIC_SIP_DOMAIN|NEXT_PUBLIC_SIP_USER' /var/www /root /opt /srv 2>/dev/null | grep -v node_modules | head -20 || echo "none found"
echo "DONE"

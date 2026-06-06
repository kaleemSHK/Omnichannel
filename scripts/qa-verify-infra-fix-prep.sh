#!/usr/bin/env bash
set -uo pipefail

echo "=== rtpengine mounts (where is its config?) ==="
docker inspect blinkone-rtpengine --format '{{range .Mounts}}{{.Source}} -> {{.Destination}} ({{.Mode}}){{println}}{{end}}' 2>/dev/null || true

echo
echo "=== rtpengine compose definition ==="
grep -rn -A25 'rtpengine:' /opt/blinkone/docker-compose.telephony.yml 2>/dev/null | head -40 || echo "no telephony compose"

echo
echo "=== firewall: ufw status ==="
ufw status verbose 2>/dev/null | head -40 || echo "ufw not active/installed"

echo
echo "=== iptables INPUT for 5060 ==="
iptables -L INPUT -n 2>/dev/null | grep -E '5060|udp|dpt' | head -20 || echo "none"

echo
echo "=== Does running kamailio.cfg == repo copy? ==="
diff -q /etc/kamailio/kamailio.cfg /opt/blinkone/infra/kamailio/kamailio-twilio-wss.cfg 2>/dev/null && echo "IDENTICAL" || echo "DIFFERENT (or missing)"

echo
echo "=== count of fraud INVITEs in last 500 kamailio log lines ==="
journalctl -u kamailio --no-pager -n 500 2>/dev/null | grep -c 'OUTBOUND PSTN' || true
echo "DONE"

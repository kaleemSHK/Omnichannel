#!/usr/bin/env bash
set -uo pipefail

echo "=== firewall: ufw status ==="
timeout 8 ufw status verbose 2>/dev/null | head -30 || echo "ufw not active/installed/timeout"

echo
echo "=== iptables INPUT for 5060 ==="
timeout 8 iptables -S 2>/dev/null | grep -E '5060|22222|30000' | head -20 || echo "no explicit rules"

echo
echo "=== kamailio.cfg vs repo ==="
diff -q /etc/kamailio/kamailio.cfg /opt/blinkone/infra/kamailio/kamailio-twilio-wss.cfg >/dev/null 2>&1 && echo "IDENTICAL" || echo "DIFFERENT"

echo
echo "=== fraud INVITE count (last 2000 log lines) ==="
timeout 12 journalctl -u kamailio --no-pager -n 2000 2>/dev/null | grep -c 'OUTBOUND PSTN' || echo "0/err"

echo
echo "=== distinct source IPs hitting kamailio (last 2000) ==="
timeout 12 journalctl -u kamailio --no-pager -n 2000 2>/dev/null | grep -oE 'from [0-9.]+' | sort | uniq -c | sort -rn | head -15 || true
echo "DONE"

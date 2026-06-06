#!/usr/bin/env bash
# Enable host firewall: lock SIP 5060 to Twilio signaling IPs, keep SSH/web/RTP open.
# Ordered so SSH is always allowed BEFORE enabling (no lockout). Kamailio runs on the
# host (not Docker), so ufw governs :5060 — exactly the fraud-flood surface.
set -uo pipefail

echo "=== current status ==="
ufw status verbose 2>/dev/null | head -3

# 1) Management + web FIRST (lockout safety)
ufw allow 22/tcp    >/dev/null
ufw allow 80/tcp    >/dev/null
ufw allow 443/tcp   >/dev/null

# 2) RTP media (rtpengine) — remote endpoints are dynamic, must stay open
ufw allow 30000:31000/udp >/dev/null

# 3) SIP 5060 — Twilio signaling CIDRs ONLY (drops the scanner/toll-fraud flood)
TWILIO_CIDRS="54.172.60.0/23 54.244.51.0/24 54.171.127.192/26 35.156.191.128/25 3.122.181.0/25 54.65.63.192/26 3.112.80.0/24 54.169.127.128/26 3.1.77.0/24 54.252.254.64/26 3.104.90.0/24 177.71.206.192/26 18.228.249.0/24"
for cidr in $TWILIO_CIDRS; do
  ufw allow from "$cidr" to any port 5060 proto udp >/dev/null
  ufw allow from "$cidr" to any port 5060 proto tcp >/dev/null
done

ufw default deny incoming  >/dev/null
ufw default allow outgoing >/dev/null
ufw --force enable

echo "=== status after enable ==="
ufw status verbose
echo "FW-DONE"

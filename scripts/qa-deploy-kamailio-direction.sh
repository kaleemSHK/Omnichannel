#!/usr/bin/env bash
# Deploy direction-flag MANAGE_REPLY fix to host Kamailio with validate + rollback.
set -uo pipefail
SRC=/tmp/kamailio-new.cfg
LIVE=/etc/kamailio/kamailio.cfg
TS=$(date +%Y%m%d-%H%M%S)
BAK=/etc/kamailio/kamailio.cfg.bak-$TS

echo "=== Validating new config ==="
if ! kamailio -c -f "$SRC" 2>/tmp/kamcheck.log; then
  echo "VALIDATION FAILED — not deploying:"; cat /tmp/kamcheck.log; echo "DEPLOY-ABORT"; exit 1
fi
echo "config OK"

echo "=== Backup → $BAK ==="
cp -a "$LIVE" "$BAK"

echo "=== Installing + restarting ==="
cp -a "$SRC" "$LIVE"
if ! systemctl restart kamailio; then
  echo "RESTART FAILED — rolling back"; cp -a "$BAK" "$LIVE"; systemctl restart kamailio; echo "DEPLOY-ROLLBACK"; exit 1
fi
sleep 2
systemctl is-active kamailio && echo "kamailio active"
echo "=== listeners ==="
ss -lnp 2>/dev/null | grep -E ':5060|:8088' | head
echo "DEPLOY-OK"

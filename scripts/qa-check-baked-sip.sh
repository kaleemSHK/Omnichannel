#!/usr/bin/env bash
set -uo pipefail

echo "=== restart_frontend_standalone.sh (does it source root .env?) ==="
sed -n '1,80p' /opt/blinkone/scripts/restart_frontend_standalone.sh 2>/dev/null || echo "missing"

echo
echo "=== deploy-labels-settings-fix.sh ==="
sed -n '1,60p' /opt/blinkone/scripts/deploy-labels-settings-fix.sh 2>/dev/null || echo "missing"

echo
echo "=== ACTUAL baked SIP value in running standalone build ==="
echo "-- occurrences of zadarma --"
grep -rl 'zadarma' /opt/blinkone/frontend/.next/ 2>/dev/null | head -5 || echo "none (zadarma not baked)"
echo "-- occurrences of sip.blinksone.com --"
grep -rl 'sip.blinksone.com' /opt/blinkone/frontend/.next/ 2>/dev/null | head -5 || echo "none"
echo "-- raw SIP_WSS-ish strings in static chunks --"
grep -rhoE 'wss://[a-zA-Z0-9./_-]+' /opt/blinkone/frontend/.next/static 2>/dev/null | sort -u | head -20 || true
echo "DONE"

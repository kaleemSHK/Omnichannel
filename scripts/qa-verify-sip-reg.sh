#!/usr/bin/env bash
set -uo pipefail

echo "=== Telephony containers ==="
docker ps --format '{{.Names}}\t{{.Image}}\t{{.Status}}' | grep -Ei 'kam|rtp|sip|ivr|calls' || true

KAM="$(docker ps --format '{{.Names}}' | grep -i kam | head -1)"
echo
echo "=== Kamailio container: ${KAM:-<none>} ==="

if [ -n "${KAM:-}" ]; then
  echo "--- ul.dump (registered AORs) ---"
  docker exec "$KAM" kamcmd ul.dump 2>/dev/null | head -80 || echo "ul.dump failed"
  echo "--- registered contacts count ---"
  docker exec "$KAM" kamcmd ul.dump 2>/dev/null | grep -c 'Contact::' || true
  echo "--- listening sockets ---"
  docker exec "$KAM" kamcmd corex.list_sockets 2>/dev/null | head -40 || true
fi

echo
echo "=== RTPengine container ==="
RTP="$(docker ps --format '{{.Names}}' | grep -i rtp | head -1)"
echo "RTP: ${RTP:-<none>}"

echo
echo "=== Current Twilio inbound webhook target (IVR_PUBLIC_URL) ==="
IVR="$(docker ps --format '{{.Names}}' | grep -i ivr | head -1)"
if [ -n "${IVR:-}" ]; then
  docker exec "$IVR" sh -c 'echo "IVR_PUBLIC_URL=$IVR_PUBLIC_URL; SIP_DOMAIN=$SIP_DOMAIN; KAMAILIO_HOST=$KAMAILIO_HOST"' 2>/dev/null || true
fi
echo "DONE"

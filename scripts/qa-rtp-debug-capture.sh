#!/usr/bin/env bash
# Enable rtpengine SDP debug, capture a call's offer/answer SDP, then revert.
set -uo pipefail
CONF=/opt/blinkone/infra/rtpengine/rtpengine-demo.conf
WIN=${1:-110}

# enable debug
cp -a "$CONF" "${CONF}.predebug" 2>/dev/null || true
grep -q '^log-level' "$CONF" || echo 'log-level = 7' >> "$CONF"
sed -i 's/^log-level.*/log-level = 7/' "$CONF"
docker restart blinkone-rtpengine >/dev/null
sleep 3
echo ">>> rtpengine debug ON — PLACE THE CALL NOW (inbound: dial +19143038893, answer, allow mic) <<<"

timeout ${WIN} docker logs -f --since 1s blinkone-rtpengine > /tmp/rtp-debug.log 2>&1 || true

echo
echo "============ OFFER/ANSWER commands + SDP (in/out) ============"
grep -nE "command '(offer|answer)'|^v=0|^m=audio|a=setup|a=fingerprint|a=rtpmap|a=candidate|a=crypto|RTP/SAVPF|RTP/AVP|sdp" /tmp/rtp-debug.log | head -120

echo
echo "============ DTLS / SRTP / ICE errors ============"
grep -nE "DTLS|SRTP|crypto|ICE|fingerprint|handshake|consent" /tmp/rtp-debug.log | head -40

# revert debug
sed -i 's/^log-level.*/log-level = 6/' "$CONF"
docker restart blinkone-rtpengine >/dev/null
echo "RTP-DEBUG-DONE (log-level reverted)"

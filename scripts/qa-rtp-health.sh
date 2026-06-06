#!/usr/bin/env bash
set -uo pipefail

echo "=== rtpengine container state ==="
docker ps --filter name=rtpengine --format '{{.Names}} | {{.Status}}'

echo
echo "=== rtpengine recent logs (last 40, around the call) ==="
docker logs --tail 40 blinkone-rtpengine 2>&1 | tail -40

echo
echo "=== raw /tmp/rtp-call.log (captured during call) ==="
wc -l /tmp/rtp-call.log; tail -40 /tmp/rtp-call.log

echo
echo "=== Kamailio: full lines for the inbound call window (00:27:5x) ==="
grep -nE '00:27:5|00:28:0' /tmp/kam-call.log | grep -viE 'BLOCKED|OUTBOUND' | head -40

echo
echo "=== rtpengine ng ping (is control socket alive?) ==="
docker exec blinkone-rtpengine sh -c 'echo "ping test"' 2>/dev/null && echo "exec ok" || true

echo
echo "=== rtpengine interface/config in effect ==="
docker exec blinkone-rtpengine cat /etc/rtpengine/rtpengine.conf 2>/dev/null || true
echo "RTPHEALTH-DONE"

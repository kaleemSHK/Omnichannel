#!/usr/bin/env bash
set -uo pipefail

echo "=== rtpengine container ==="
docker ps --filter name=rtpengine --format '{{.Names}} | {{.Image}} | {{.Status}} | {{.Ports}}'

echo
echo "=== rtpengine command/args ==="
docker inspect blinkone-rtpengine --format '{{json .Args}}' 2>/dev/null || true
docker inspect blinkone-rtpengine --format '{{json .Config.Cmd}}' 2>/dev/null || true

echo
echo "=== rtpengine recent logs (tail 30) ==="
docker logs --tail 30 blinkone-rtpengine 2>&1 | tail -30 || true

echo
echo "=== rtpengine active sessions / port usage (ng cli) ==="
docker exec blinkone-rtpengine sh -c 'rtpengine-ctl list sessions 2>/dev/null | head -5; echo "--- totals ---"; rtpengine-ctl list totals 2>/dev/null | head -30' 2>/dev/null || echo "rtpengine-ctl unavailable"

echo
echo "=== repo rtpengine-demo.conf ==="
cat /opt/blinkone/infra/rtpengine/rtpengine-demo.conf 2>/dev/null || echo "no conf file"

echo
echo "=== UDP ports in rtpengine range currently bound ==="
ss -lnu 2>/dev/null | awk '{print $5}' | grep -oE ':[0-9]+$' | tr -d ':' | sort -n | awk '$1>=10000 && $1<=40000' | wc -l
echo "DONE"

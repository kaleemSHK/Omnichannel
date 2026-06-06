#!/usr/bin/env bash
set -uo pipefail
CONF=/opt/blinkone/infra/rtpengine/rtpengine-demo.conf
if grep -q '^log-level' "$CONF"; then
  sed -i 's/^log-level.*/log-level = 7/' "$CONF"
else
  echo 'log-level = 7' >> "$CONF"
fi
echo "--- conf now ---"
cat "$CONF"
docker restart blinkone-rtpengine >/dev/null
sleep 2
echo "rtpengine: $(docker ps --filter name=rtpengine --format '{{.Status}}')"
echo "DEBUG_ON_OK"

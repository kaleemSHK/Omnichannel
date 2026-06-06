#!/usr/bin/env bash
# RTPEngine for demo server — WebRTC (browser) ↔ RTP (Twilio SIP trunk)
set -euo pipefail
ROOT="${BLINKONE_ROOT:-/opt/blinkone}"
EXTERNAL_IP="${RTPENGINE_EXTERNAL_IP:-204.168.137.104}"

cd "$ROOT/infra/rtpengine"
docker build -t blinkone-rtpengine:demo .
docker rm -f blinkone-rtpengine 2>/dev/null || true
docker run -d --name blinkone-rtpengine --restart unless-stopped \
  --network host \
  --entrypoint /usr/bin/rtpengine \
  -v "$ROOT/infra/rtpengine/rtpengine-demo.conf:/etc/rtpengine/rtpengine.conf:ro" \
  blinkone-rtpengine:demo \
  --config-file=/etc/rtpengine/rtpengine.conf --foreground --log-stderr

sleep 2
if ! ss -ulnp | grep -q ':22222'; then
  echo "❌ RTPEngine not listening on UDP 22222"
  docker logs blinkone-rtpengine --tail 30
  exit 1
fi
echo "✅ RTPEngine running (ng 127.0.0.1:22222, RTP 30000-30100, interface $EXTERNAL_IP)"

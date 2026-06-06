#!/usr/bin/env bash
set -euo pipefail
cd /opt/blinkone
cp -r /tmp/p30-fix/lib/ivr/* services/ivr/lib/ 2>/dev/null || cp -r /tmp/p30-fix/lib services/ivr/ 2>/dev/null || true
cp -r /tmp/p30-fix/src/ivr/* services/ivr/src/ 2>/dev/null || true
cp -r /tmp/p30-fix/lib/voicebot services/ai/lib/ 2>/dev/null || cp /tmp/p30-fix/lib/voicebot/fsm.js services/ai/lib/voicebot/fsm.js
cp /tmp/p30-fix/src/server.js services/ai/src/server.js 2>/dev/null || true
cp /tmp/p30-fix/lib/chatwoot-broadcast.js services/calls/lib/chatwoot-broadcast.js
cp /tmp/p30-fix/src/server.js services/calls/src/server.js 2>/dev/null || true

# overlay broadcast controller
if [ -f chatwoot-fork-overlay/app/controllers/blinkone/calls_broadcast_controller.rb ]; then
  cp chatwoot-fork-overlay/app/controllers/blinkone/calls_broadcast_controller.rb \
    chatwoot-fork-overlay/app/controllers/blinkone/calls_broadcast_controller.rb.bak
fi

docker compose build ivr ai calls
docker compose up -d ivr ai calls
docker compose restart chatwoot 2>/dev/null || true
cd frontend && npm run build && pm2 restart blinkone-frontend
echo "Deploy done. Test: bash scripts/test-ivr-inbound.sh"

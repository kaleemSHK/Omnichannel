#!/bin/bash
set -euo pipefail
cd /opt/blinkone
set -a
# shellcheck disable=SC1091
source .env
set +a
docker cp scripts/setup-chatwoot-instagram-config.rb blinkone-chatwoot-1:/tmp/setup-chatwoot-instagram-config.rb
docker exec \
  -e IG_VERIFY_TOKEN="${IG_VERIFY_TOKEN:-blinkone_ig_2026}" \
  -e INSTAGRAM_VERIFY_TOKEN="${IG_VERIFY_TOKEN:-blinkone_ig_2026}" \
  -e INSTAGRAM_APP_ID="${INSTAGRAM_APP_ID:-}" \
  -e INSTAGRAM_APP_SECRET="${INSTAGRAM_APP_SECRET:-}" \
  -e FB_APP_ID="${FB_APP_ID:-}" \
  -e FB_APP_SECRET="${FB_APP_SECRET:-}" \
  -e FB_VERIFY_TOKEN="${FB_VERIFY_TOKEN:-blinkone_fb_2026}" \
  -e FRONTEND_URL="${FRONTEND_URL:-https://app.blinksone.com}" \
  blinkone-chatwoot-1 bundle exec rails runner /tmp/setup-chatwoot-instagram-config.rb
docker compose up -d chatwoot sidekiq

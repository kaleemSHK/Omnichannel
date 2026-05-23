# BlinkOne-branded Chatwoot CE — overlay + Vite rebuild (Waves A–D)
# Build requires ~8–10 GB RAM for Docker Desktop (Node heap below).
FROM chatwoot/chatwoot:v4.13.0-ce

USER root
WORKDIR /app

# Match upstream Chatwoot asset build settings (OOM fix)
ENV NODE_OPTIONS="--max-old-space-size=8192 --openssl-legacy-provider" \
    HUSKY=0 \
    CI=true \
    RAILS_ENV=production \
    SECRET_KEY_BASE=precompile_placeholder \
    RAILS_LOG_TO_STDOUT=enabled \
    NODE_ENV=production \
    BUNDLE_WITHOUT="development:test"

RUN apk add --no-cache nodejs npm curl git build-base && \
    npm install -g pnpm@10.2.0

# Overlay (i18n merge, mailers, layouts, public assets)
COPY chatwoot-fork-overlay/app/ /app/app/
COPY chatwoot-fork-overlay/config/ /app/config/
COPY chatwoot-fork-overlay/public/ /app/public/

COPY lib/blink_one/ /app/lib/blink_one/
COPY config/blinkone/ /app/config/blinkone/
COPY config/initializers/00_blinkone_zeitwerk.rb /app/config/initializers/00_blinkone_zeitwerk.rb
COPY config/initializers/blinkone_branding.rb /app/config/initializers/blinkone_branding.rb
COPY lib/tasks/blinkone_branding.rake /app/lib/tasks/blinkone_branding.rake
COPY lib/tasks/blinkone_demo.rake /app/lib/tasks/blinkone_demo.rake
COPY lib/blink_one/demo_seeder.rb /app/lib/blink_one/demo_seeder.rb
COPY scripts/blinkone/patch-chatwoot-telephony.mjs /tmp/patch-chatwoot-telephony.mjs
COPY scripts/blinkone/patch-chatwoot-calling-inbox.mjs /tmp/patch-chatwoot-calling-inbox.mjs
COPY scripts/blinkone/patch-chatwoot-enterprise.mjs /tmp/patch-chatwoot-enterprise.mjs

RUN node /tmp/patch-chatwoot-telephony.mjs && node /tmp/patch-chatwoot-calling-inbox.mjs && node /tmp/patch-chatwoot-enterprise.mjs

# jssip is added by patch-chatwoot-calling-inbox.mjs; lockfile is not updated in-repo
RUN CI=false pnpm install --no-frozen-lockfile

# Precompile: rebuilds dashboard + widget bundles with BlinkOne i18n
RUN bundle exec rake assets:precompile

RUN apk del build-base git curl 2>/dev/null || true

# Keep same entrypoint as upstream (compose sets docker/entrypoints/rails.sh)

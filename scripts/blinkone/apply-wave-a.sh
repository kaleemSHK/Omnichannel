#!/usr/bin/env bash
# Apply Wave A branding inside running Chatwoot container
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
ENV_FILE="${ENV_FILE:-.env}"
PROJECT="${COMPOSE_PROJECT_NAME:-blinkone}"

echo "==> Wave A: InstallationConfig + env branding"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" -p "$PROJECT" exec -T chatwoot \
  bundle exec rake blinkone:apply_branding

echo "==> Done. Restart chatwoot + sidekiq if dashboard still shows old name:"
echo "    docker compose -f $COMPOSE_FILE --env-file $ENV_FILE -p $PROJECT restart chatwoot sidekiq"

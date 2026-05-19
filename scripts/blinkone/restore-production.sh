#!/usr/bin/env bash
# Restore BlinkOne from a backup produced by backup-production.sh
# Usage: ./restore-production.sh <timestamp> [target]
#   target: production (default) | staging
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

TIMESTAMP="${1:?Usage: restore-production.sh <timestamp> [production|staging]}"
TARGET="${2:-production}"

BACKUP_ROOT="${BLINKONE_BACKUP_DIR:-$REPO_ROOT/backups}"
SRC="$BACKUP_ROOT/$TIMESTAMP"

if [[ ! -d "$SRC" ]]; then
  echo "Backup not found: $SRC" >&2
  exit 1
fi

if [[ "$TARGET" == "staging" ]]; then
  COMPOSE_FILE="docker-compose.staging.yml"
  ENV_FILE="${ENV_FILE:-.env.staging}"
  PROJECT="${COMPOSE_PROJECT_NAME:-blinkone-staging}"
  POSTGRES_SERVICE="postgres"
  POSTGRES_USER="${POSTGRES_USER:-postgres}"
  POSTGRES_DB="${POSTGRES_DB:-chatwoot_staging}"
  STORAGE_VOLUME="${STORAGE_VOLUME:-blinkone-staging_chatwoot_storage}"
else
  COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
  ENV_FILE="${ENV_FILE:-.env.production}"
  PROJECT="${COMPOSE_PROJECT_NAME:-blinkone}"
  POSTGRES_SERVICE="${POSTGRES_SERVICE:-postgres}"
  POSTGRES_USER="${POSTGRES_USER:-postgres}"
  POSTGRES_DB="${POSTGRES_DB:-chatwoot}"
  STORAGE_VOLUME="${STORAGE_VOLUME:-blinkone_chatwoot_storage}"
fi

[[ -f "$ENV_FILE" ]] || ENV_FILE=".env"

echo "==> Restore $TIMESTAMP → $TARGET ($COMPOSE_FILE)"
read -r -p "This will OVERWRITE database and storage. Type the backup id to confirm: " CONFIRM
[[ "$CONFIRM" == "$TIMESTAMP" ]] || { echo "Aborted."; exit 1; }

DC=(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" -p "$PROJECT")

echo "==> Stop Chatwoot workers"
"${DC[@]}" stop sidekiq chatwoot 2>/dev/null || true

echo "==> PostgreSQL restore"
gunzip -c "$SRC/chatwoot.sql.gz" | "${DC[@]}" exec -T "$POSTGRES_SERVICE" \
  psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${POSTGRES_DB}' AND pid <> pg_backend_pid();" || true
"${DC[@]}" exec -T "$POSTGRES_SERVICE" \
  psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ${POSTGRES_DB};"
"${DC[@]}" exec -T "$POSTGRES_SERVICE" \
  psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${POSTGRES_DB};"
gunzip -c "$SRC/chatwoot.sql.gz" | "${DC[@]}" exec -T "$POSTGRES_SERVICE" \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1

if [[ -f "$SRC/storage.tar.gz" ]]; then
  echo "==> Active Storage volume"
  docker run --rm \
    -v "${STORAGE_VOLUME}:/data" \
    -v "$SRC:/backup:ro" \
    alpine:3.20 \
    sh -c "rm -rf /data/* /data/.[!.]* 2>/dev/null; tar -xzf /backup/storage.tar.gz -C /data"
fi

echo "==> Start stack"
"${DC[@]}" up -d

echo "==> Restore complete."

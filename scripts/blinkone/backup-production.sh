#!/usr/bin/env bash
# Backup BlinkOne production (Chatwoot DB + Active Storage volume + env).
# Safe during business hours: uses pg_dump (not pg_dumpall).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"
if [[ ! -f "$ENV_FILE" && -f .env ]]; then
  ENV_FILE=".env"
fi

# shellcheck disable=SC1090
[[ -f "$ENV_FILE" ]] && set -a && source "$ENV_FILE" && set +a

TIMESTAMP="${1:-$(date -u +%Y%m%dT%H%M%SZ)}"
BACKUP_ROOT="${BLINKONE_BACKUP_DIR:-$REPO_ROOT/backups}"
DEST="$BACKUP_ROOT/$TIMESTAMP"
mkdir -p "$DEST"

POSTGRES_SERVICE="${POSTGRES_SERVICE:-postgres}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-chatwoot}"
STORAGE_VOLUME="${STORAGE_VOLUME:-blinkone_chatwoot_storage}"
BUCKET="${BLINKONE_BACKUP_BUCKET:-}"

echo "==> BlinkOne backup → $DEST"

echo "==> PostgreSQL (Chatwoot)"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T "$POSTGRES_SERVICE" \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-acl \
  | gzip -9 > "$DEST/chatwoot.sql.gz"

echo "==> Active Storage volume"
docker run --rm \
  -v "${STORAGE_VOLUME}:/data:ro" \
  -v "$DEST:/backup" \
  alpine:3.20 \
  tar -czf /backup/storage.tar.gz -C /data .

if [[ -f "$ENV_FILE" ]]; then
  echo "==> Environment file"
  if command -v age >/dev/null 2>&1 && [[ -n "${AGE_RECIPIENT:-}" ]]; then
    age -r "$AGE_RECIPIENT" -o "$DEST/env.production.age" "$ENV_FILE"
    echo "    Encrypted with age → env.production.age"
  else
    cp "$ENV_FILE" "$DEST/env.production"
    echo "    WARNING: age not configured (set AGE_RECIPIENT). Copied plaintext — restrict permissions."
    chmod 600 "$DEST/env.production"
  fi
fi

cat > "$DEST/manifest.json" <<EOF
{
  "timestamp": "$TIMESTAMP",
  "postgres_db": "$POSTGRES_DB",
  "storage_volume": "$STORAGE_VOLUME",
  "compose_file": "$COMPOSE_FILE"
}
EOF

if [[ -n "$BUCKET" ]]; then
  echo "==> Upload to object storage: $BUCKET"
  if command -v aws >/dev/null 2>&1; then
    aws s3 sync "$DEST" "s3://${BUCKET}/blinkone/${TIMESTAMP}/" --only-show-errors
  elif command -v mc >/dev/null 2>&1; then
    mc mirror "$DEST" "${BUCKET}/blinkone/${TIMESTAMP}/"
  else
    echo "    WARNING: BLINKONE_BACKUP_BUCKET set but neither aws nor mc found. Skipping upload."
  fi
fi

echo "==> Done. Backup id: $TIMESTAMP"

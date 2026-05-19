#!/usr/bin/env bash
# Clone latest (or specified) production backup into staging.
# Usage: ./clone-prod-to-staging.sh [--redact] [backup_timestamp]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

REDACT=false
TIMESTAMP=""

for arg in "$@"; do
  case "$arg" in
    --redact) REDACT=true ;;
    *) TIMESTAMP="$arg" ;;
  esac
done

BACKUP_ROOT="${BLINKONE_BACKUP_DIR:-$REPO_ROOT/backups}"
if [[ -z "$TIMESTAMP" ]]; then
  TIMESTAMP="$(ls -1t "$BACKUP_ROOT" 2>/dev/null | head -1 || true)"
fi
[[ -n "$TIMESTAMP" ]] || { echo "No backups found in $BACKUP_ROOT" >&2; exit 1; }

SRC="$BACKUP_ROOT/$TIMESTAMP"
WORK="$BACKUP_ROOT/.staging-clone-${TIMESTAMP}"
rm -rf "$WORK"
mkdir -p "$WORK"

echo "==> Preparing clone from $TIMESTAMP (redact=$REDACT)"

cp "$SRC/chatwoot.sql.gz" "$WORK/chatwoot.sql.gz"
cp "$SRC/storage.tar.gz" "$WORK/storage.tar.gz" 2>/dev/null || true
[[ -f "$SRC/manifest.json" ]] && cp "$SRC/manifest.json" "$WORK/manifest.json"

if [[ "$REDACT" == true ]]; then
  echo "==> PII redaction (deterministic SHA-256 prefixes)"
  gunzip -c "$WORK/chatwoot.sql.gz" > "$WORK/chatwoot.sql"
  python3 - "$WORK/chatwoot.sql" <<'PY'
import hashlib, re, sys
path = sys.argv[1]
data = open(path, encoding="utf-8", errors="replace").read()

def h(label: str, value: str) -> str:
    digest = hashlib.sha256(f"{label}:{value}".encode()).hexdigest()[:16]
    return f"redacted_{label}_{digest}"

# Emails in COPY/INSERT payloads (simple patterns)
data = re.sub(
    r"([a-zA-Z0-9_.+-]+)@([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)",
    lambda m: h("email", m.group(0)) + "@redacted.local",
    data,
)
# E.164-ish phone numbers
data = re.sub(r"\+\d{8,15}", lambda m: h("phone", m.group(0)), data)
# Contact display names in common Chatwoot columns (heuristic: name fields in contacts)
data = re.sub(
    r"(\bname\b[^,\n]*,\s*)'([^']{2,80})'",
    lambda m: f"{m.group(1)}'{h('name', m.group(2))}'",
    data,
    flags=re.IGNORECASE,
)

open(path, "w", encoding="utf-8").write(data)
PY
  gzip -9 -c "$WORK/chatwoot.sql" > "$WORK/chatwoot.sql.gz"
  rm -f "$WORK/chatwoot.sql"
fi

# Stage under backups for restore script
STAGING_ID="staging-from-${TIMESTAMP}"
DEST="$BACKUP_ROOT/$STAGING_ID"
rm -rf "$DEST"
mkdir -p "$DEST"
mv "$WORK/chatwoot.sql.gz" "$DEST/"
[[ -f "$WORK/storage.tar.gz" ]] && mv "$WORK/storage.tar.gz" "$DEST/"
[[ -f "$WORK/manifest.json" ]] && mv "$WORK/manifest.json" "$DEST/"
rmdir "$WORK" 2>/dev/null || rm -rf "$WORK"

ENV_STAGING="${ENV_FILE:-.env.staging}"
[[ -f "$ENV_STAGING" ]] || { echo "Missing $ENV_STAGING — copy from .env.staging.example" >&2; exit 1; }

echo "==> Restore into staging"
COMPOSE_PROJECT_NAME=blinkone-staging ENV_FILE="$ENV_STAGING" \
  "$SCRIPT_DIR/restore-production.sh" "$STAGING_ID" staging

echo "==> Staging ready at ${FRONTEND_URL:-http://localhost:8080}"

#!/usr/bin/env bash
# Regenerate docs/blinkone/ENTERPRISE_DO_NOT_TOUCH.md from enterprise/ paths.
# Run from repo root. Safe if enterprise/ is absent (fork not checked out).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OUT="$REPO_ROOT/docs/blinkone/ENTERPRISE_DO_NOT_TOUCH.md"
ENTERPRISE_DIR="$REPO_ROOT/enterprise"
CHATWOOT_FORK="${CHATWOOT_FORK_DIR:-}"

{
  echo "# Enterprise directory — DO NOT TOUCH"
  echo ""
  echo "Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ) by \`scripts/blinkone/audit-enterprise-blocklist.sh\`"
  echo ""
  echo "The \`enterprise/\` tree is licensed under the **Chatwoot Enterprise License**. Do not read, copy, port, rebrand, or commit changes under this path."
  echo ""
  echo "Rebuild TRD features in BlinkOne sidecars or MIT-licensed \`app/blinkone/\` modules instead."
  echo ""
} > "$OUT"

scan_dir() {
  local dir="$1"
  local label="$2"
  if [[ ! -d "$dir/enterprise" ]]; then
    echo "## $label" >> "$OUT"
    echo "" >> "$OUT"
    echo "_No \`enterprise/\` directory present._" >> "$OUT"
    echo "" >> "$OUT"
    return
  fi
  echo "## $label" >> "$OUT"
  echo "" >> "$OUT"
  echo "Path count: $(find "$dir/enterprise" -type f | wc -l | tr -d ' ')" >> "$OUT"
  echo "" >> "$OUT"
  echo '```' >> "$OUT"
  find "$dir/enterprise" -type f | sed "s|^$dir/||" | sort >> "$OUT"
  echo '```' >> "$OUT"
  echo "" >> "$OUT"
}

scan_dir "$REPO_ROOT" "This repository"
if [[ -n "$CHATWOOT_FORK" && -d "$CHATWOOT_FORK" ]]; then
  scan_dir "$CHATWOOT_FORK" "CHATWOOT_FORK_DIR"
fi

echo "Wrote $OUT"

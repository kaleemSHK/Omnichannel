#!/usr/bin/env bash
# Fail if any staged path is under enterprise/
set -euo pipefail

BLOCKED=$(git diff --cached --name-only --diff-filter=ACMR | grep -E '(^|/)enterprise/' || true)

if [[ -n "$BLOCKED" ]]; then
  echo "ERROR: Commit blocked — staged files under enterprise/ (Chatwoot Enterprise License)." >&2
  echo "$BLOCKED" >&2
  echo "Build the feature in a BlinkOne sidecar or MIT module instead." >&2
  exit 1
fi

exit 0

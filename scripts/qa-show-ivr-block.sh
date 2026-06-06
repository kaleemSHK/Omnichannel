#!/usr/bin/env bash
set -uo pipefail
cd /opt/blinkone

echo "=== docker-compose.override.yml (full) ==="
cat docker-compose.override.yml

echo
echo "=== ivr service block in docker-compose.yml ==="
awk '/^  ivr:/{f=1} f{print} f&&/^  [a-z][a-z_-]*:/&&!/^  ivr:/{exit}' docker-compose.yml \
  | sed -E 's/(TOKEN[:=]).*/\1<redacted>/'

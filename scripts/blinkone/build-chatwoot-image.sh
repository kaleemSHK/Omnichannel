#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
export DOCKER_BUILDKIT=1
echo "Building blinkone/chatwoot (requires Docker RAM ~10GB)..."
if ! docker compose build chatwoot; then
  echo "Full build failed. Lightweight fallback (no Wave C bundle):"
  echo "  docker build -f docker/chatwoot-blinkone/Dockerfile.nobuild -t blinkone/chatwoot:v4.13.0-ce-b1-nobuild ."
  exit 1
fi
echo "Done."

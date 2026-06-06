#!/usr/bin/env bash
# Seed real RAG collections/documents for tenant 1 (BlinkOne demo).
set -euo pipefail
cd "$(dirname "$0")/.."
TENANT_ID="${TENANT_ID:-1}"
export TENANT_ID
export FORCE="${FORCE:-0}"
docker compose build ai
docker compose up -d ai
docker compose exec -T ai node scripts/seed-rag-knowledge.mjs

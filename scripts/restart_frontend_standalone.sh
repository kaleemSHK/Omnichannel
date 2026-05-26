#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy-frontend.sh  — Full BlinkOne frontend deploy
#
# Usage:
#   bash scripts/restart_frontend_standalone.sh          # pull latest + build
#   SKIP_PULL=1 bash scripts/restart_frontend_standalone.sh  # rebuild only
#
# Steps:
#   1. git pull (origin/main) unless SKIP_PULL=1
#   2. npm ci
#   3. next build  (output: standalone)
#   4. Copy static assets into standalone dir  ← fixes MIME-type bug
#   5. pm2 restart (graceful)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="${BLINKONE_ROOT:-/opt/blinkone}"
FRONTEND="$ROOT/frontend"

# ── 1. Pull latest code ───────────────────────────────────────────────────────
if [[ "${SKIP_PULL:-0}" != "1" ]]; then
  echo "▶ [1/5] Pulling latest code from origin/main…"
  cd "$ROOT"
  git fetch origin
  git reset --hard origin/main
  # Restore server-local env files that git reset would never touch
  # (they're .gitignored, but belt-and-suspenders)
  echo "  Commit: $(git log --oneline -1)"
else
  echo "▶ [1/5] Skipping git pull (SKIP_PULL=1)"
fi

# ── 2. Install dependencies ───────────────────────────────────────────────────
echo "▶ [2/5] Installing npm dependencies…"
cd "$FRONTEND"
npm ci --prefer-offline 2>&1 | tail -3

# ── 3. Build Next.js ─────────────────────────────────────────────────────────
echo "▶ [3/5] Building Next.js (standalone)…"
npm run build 2>&1 | tail -20

# ── 4. Copy static assets into standalone output ─────────────────────────────
#
# WHY THIS IS REQUIRED:
#   Next.js `output: 'standalone'` produces a self-contained server.js but does
#   NOT copy .next/static or public/ into the standalone bundle.
#   Without this step nginx (aliased to .next/standalone/.next/static/) would
#   serve a 404 HTML page for every CSS/JS/font request, causing the browser to
#   reject the file with "MIME type mismatch" (text/html ≠ text/css).
#
echo "▶ [4/5] Linking static assets into standalone bundle…"
cp -r public .next/standalone/public 2>/dev/null || true
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
echo "  CSS  files: $(ls .next/standalone/.next/static/css/  2>/dev/null | wc -l)"
echo "  Media files: $(ls .next/standalone/.next/static/media/ 2>/dev/null | wc -l)"
echo "  JS chunks:  $(ls .next/standalone/.next/static/chunks/ 2>/dev/null | wc -l)"

# ── 5. Restart PM2 ───────────────────────────────────────────────────────────
echo "▶ [5/5] Restarting PM2 process…"
if pm2 show blinkone-frontend > /dev/null 2>&1; then
  pm2 restart blinkone-frontend --update-env
else
  # First-time start
  pm2 start ecosystem.config.cjs
fi
pm2 save

echo ""
echo "✅ Deploy complete"
echo "   Commit  : $(cd "$ROOT" && git log --oneline -1)"
echo "   Build ID: $(cat "$FRONTEND/.next/BUILD_ID")"
echo "   URL     : https://app.blinksone.com"

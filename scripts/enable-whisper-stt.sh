#!/usr/bin/env bash
# Enable local Whisper STT on the BlinkOne server
set -euo pipefail
ROOT="${BLINKONE_ROOT:-/opt/blinkone}"
cd "$ROOT"

ENV_FILE="$ROOT/.env"
upsert_env() {
  local key="$1" val="$2"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
  else
    echo "${key}=${val}" >> "$ENV_FILE"
  fi
}

upsert_env STT_PROVIDER whisper
upsert_env WHISPER_STT_ENABLED 1
upsert_env WHISPER_MODEL "${WHISPER_MODEL:-small}"
upsert_env GOOGLE_STT_STUB 1

echo "Pulling Whisper image (first run downloads ~500MB model)..."
docker compose pull blinkone-whisper
docker compose up -d blinkone-whisper
echo "Waiting for Whisper ASR (check: docker compose logs -f blinkone-whisper)..."
for i in $(seq 1 60); do
  if curl -sf http://127.0.0.1:8900/ >/dev/null 2>&1; then
    echo "Whisper ASR is up on :8900"
    break
  fi
  sleep 10
  echo "  ... still starting ($i/60)"
done

docker compose build ai
docker compose up -d ai
sleep 3
bash "$ROOT/scripts/verify-prompt30.sh" 2>/dev/null || true
echo "Done. Expect stt_mode: whisper_small (or whisper_<model>)"

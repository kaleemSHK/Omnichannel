#!/usr/bin/env bash
# Complete PROMPT_30 checklist on the BlinkOne server (run as root in /opt/blinkone)
set -euo pipefail

ROOT="${BLINKONE_ROOT:-/opt/blinkone}"
cd "$ROOT"

ENV_FILE="$ROOT/.env"
SECRETS="$ROOT/secrets/google-stt.json"

upsert_env() {
  local key="$1" val="$2"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
  else
    echo "${key}=${val}" >> "$ENV_FILE"
  fi
}

echo "==> 1. MinIO stub (no minio container in default compose)"
upsert_env MINIO_STUB 1

echo "==> 2. Enable Piper TTS (live)"
upsert_env PIPER_STUB 0
upsert_env PIPER_FALLBACK_STUB 1
upsert_env VOICEBOT_LANGUAGE ar-OM
upsert_env IVR_PUBLIC_URL "${IVR_PUBLIC_URL:-https://app.blinksone.com/api/ivr}"

echo "==> 3. Whisper STT (local, free)"
upsert_env STT_PROVIDER whisper
upsert_env WHISPER_STT_ENABLED 1
upsert_env WHISPER_MODEL "${WHISPER_MODEL:-small}"

echo "==> 4. Google STT credentials (optional — overrides if STT_PROVIDER=google)"
if [[ -f "$SECRETS" ]] && [[ "$(wc -c < "$SECRETS")" -gt 100 ]]; then
  PROJECT_ID="$(python3 -c "import json; print(json.load(open('$SECRETS'))['project_id'])" 2>/dev/null || true)"
  if [[ -n "${PROJECT_ID:-}" ]]; then
    upsert_env GOOGLE_STT_STUB 0
    upsert_env GOOGLE_STT_PROJECT_ID "$PROJECT_ID"
    upsert_env GOOGLE_STT_KEY_PATH "$SECRETS"
    upsert_env GOOGLE_STT_LOCATION global
    upsert_env GOOGLE_STT_MODEL chirp_2
    upsert_env GOOGLE_STT_FALLBACK_STUB 1
    echo "    Google STT: enabled for project $PROJECT_ID"
  else
    echo "    WARN: google-stt.json invalid — keeping GOOGLE_STT_STUB=1"
    upsert_env GOOGLE_STT_STUB 1
  fi
else
  echo "    WARN: Missing $SECRETS (upload GCP service account JSON first)"
  upsert_env GOOGLE_STT_STUB 1
fi

echo "==> 5. Ensure voice_bot feature for tenant 1"
docker compose exec -T postgres_app psql -U app -d blinkone_app -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO tenant_features (tenant_id, feature_key, enabled, config)
VALUES ('1', 'voice_bot', true, '{}')
ON CONFLICT (tenant_id, feature_key) DO UPDATE SET enabled = true;
SQL

echo "==> 6. Restart AI + IVR + gateway + Whisper"
docker compose up -d blinkone-whisper blinkone-piper ai ivr gateway

echo "==> 7. Wait for services (Whisper model download may take several minutes on first run)"
sleep 5

echo "==> 8. Voicebot status"
AI_TOKEN="$(grep '^AI_TOKEN=' "$ENV_FILE" | cut -d= -f2-)"
curl -sf -H "Authorization: Bearer ${AI_TOKEN}" -H "X-Blinkone-Tenant-Id: 1" \
  "http://127.0.0.1:8787/api/ai/v1/voicebot/status" | python3 -m json.tool || true

echo "==> 9. IVR inbound smoke test (TwiML)"
curl -sf -X POST "http://127.0.0.1:8787/api/ivr/v1/ivr/inbound" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "X-Blinkone-Tenant-Id: 1" \
  -d "CallSid=smoke-$(date +%s)&From=%2B96890000000&To=%2B19143038893" | head -c 400
echo ""

echo ""
echo "Done. Twilio: set Voice URL to https://app.blinksone.com/api/ivr/v1/ivr/inbound"
echo "Upload GCP key: scp google-stt-key.json root@SERVER:$SECRETS && bash $0"

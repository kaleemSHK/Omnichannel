#!/usr/bin/env bash
# PROMPT 31 — enable MinIO + recording storage on server
set -euo pipefail
cd "${BLINKONE_ROOT:-/opt/blinkone}"

upsert_env() {
  local key="$1" val="$2"
  if grep -q "^${key}=" .env 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${val}|" .env
  else
    echo "${key}=${val}" >> .env
  fi
}

upsert_env MINIO_STUB 0
upsert_env MINIO_ROOT_USER blinkone
upsert_env MINIO_ROOT_PASSWORD "${MINIO_ROOT_PASSWORD:-blinkone-minio-secret}"

echo "Starting MinIO..."
docker compose up -d blinkone-minio
echo "Waiting for MinIO healthy..."
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:9000/minio/health/live >/dev/null; then
    echo "MinIO healthy"
    break
  fi
  sleep 2
done

docker compose run --rm minio-init

echo "Rebuilding recording + ai..."
docker compose build recording ai
docker compose up -d recording ai blinkone-minio

sleep 3
docker compose exec -T recording printenv MINIO_STUB STORAGE_BACKEND MINIO_ENDPOINT || true
echo "Test upload..."
REC_TOKEN=$(grep '^RECORDING_TOKEN=' .env | cut -d= -f2-)
dd if=/dev/zero bs=1024 count=4 2>/dev/null | curl -s -w "\nHTTP:%{http_code}\n" -X POST "http://127.0.0.1:8787/api/recordings/v1/recordings" \
  -H "Authorization: Bearer ${REC_TOKEN}" \
  -H "X-Blinkone-Tenant-Id: 1" \
  -F "callId=test-minio-001" \
  -F "chatwootAccountId=1" \
  -F "durationMs=4000" \
  -F "direction=inbound" \
  -F "audio=@-;filename=test.wav;type=audio/wav" || true

echo "Done. MinIO console: ssh tunnel 127.0.0.1:9001"

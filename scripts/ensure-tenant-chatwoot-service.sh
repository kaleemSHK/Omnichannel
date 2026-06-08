#!/usr/bin/env bash
# Ensure tenant-scoped Chatwoot automation tokens for all tenants (or one tenant).
set -euo pipefail
cd /opt/blinkone

TENANT_ID="${1:-}"
TOKEN=$(docker exec blinkone-tenant-1 printenv TOKEN 2>/dev/null || docker exec blinkone-tenant-1 printenv PLATFORM_TOKEN)

if [[ -n "$TENANT_ID" ]]; then
  IDS=("$TENANT_ID")
else
  mapfile -t IDS < <(
    docker exec blinkone-postgres_app-1 psql -U app -d blinkone_app -t -A \
      -c "SELECT id FROM tenants ORDER BY id"
  )
fi

for tid in "${IDS[@]}"; do
  [[ -z "$tid" ]] && continue
  echo "=== Tenant $tid ==="

  ACCOUNT_ID=$(docker exec blinkone-postgres_app-1 psql -U app -d blinkone_app -t -A \
    -c "SELECT chatwoot_account_id FROM tenants WHERE id = '$tid' LIMIT 1")

  docker cp scripts/ensure-tenant-chatwoot-service.rb blinkone-chatwoot-1:/tmp/ensure-tenant-chatwoot-service.rb
  OUT=$(docker exec -e ACCOUNT_ID="$ACCOUNT_ID" -e TENANT_ID="$tid" \
    blinkone-chatwoot-1 bundle exec rails runner /tmp/ensure-tenant-chatwoot-service.rb 2>&1) || true
  echo "$OUT"

  CW_TOKEN=$(echo "$OUT" | sed -n 's/^TOKEN=//p' | tail -1)
  CW_USER=$(echo "$OUT" | sed -n 's/^USER_ID=//p' | tail -1)
  CW_EMAIL=$(echo "$OUT" | sed -n 's/^EMAIL=//p' | tail -1)

  if [[ -z "$CW_TOKEN" ]]; then
    echo "WARN: rails ensure failed for tenant $tid — trying tenant API"
    docker exec blinkone-tenant-1 wget -qO- \
      --header="Authorization: Bearer ${TOKEN}" \
      "http://127.0.0.1:8802/v1/internal/chatwoot-service-token?tenant_id=${tid}&refresh=1" || true
    echo
    continue
  fi

  docker exec blinkone-postgres_app-1 psql -U app -d blinkone_app -c \
    "INSERT INTO tenant_chatwoot_service (tenant_id, chatwoot_user_id, service_email, access_token)
     VALUES ('$tid', $CW_USER, '$CW_EMAIL', '$CW_TOKEN')
     ON CONFLICT (tenant_id) DO UPDATE SET
       chatwoot_user_id = EXCLUDED.chatwoot_user_id,
       service_email = EXCLUDED.service_email,
       access_token = EXCLUDED.access_token,
       token_updated_at = now();"

  echo "OK tenant $tid automation token stored"
done

echo "Done."

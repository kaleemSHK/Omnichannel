#!/usr/bin/env bash
set -euo pipefail
cd /opt/blinkone

echo "=== tenant_features escalation rows ==="
docker compose exec -T postgres_app psql -U app -d blinkone_app -c \
  "SELECT tenant_id, feature_key, enabled FROM tenant_features WHERE feature_key='escalation' ORDER BY tenant_id;"

echo ""
echo "=== tenants ==="
docker compose exec -T postgres_app psql -U app -d blinkone_app -c \
  "SELECT id, name, slug, chatwoot_account_id, billing_plan_id FROM tenants ORDER BY id;"

echo ""
echo "=== escalation env ==="
docker compose exec -T escalation printenv | grep -E 'TENANT|TOKEN|FEATURE|ESCALATION' || true

echo ""
echo "=== tenant service: GET /v1/tenants/1 ==="
TENANT_TOKEN=$(grep -E '^TENANT_TOKEN=|^PLATFORM_TOKEN=' .env | head -1 | cut -d= -f2-)
curl -s -H "Authorization: Bearer ${TENANT_TOKEN}" http://127.0.0.1:8802/v1/tenants/1 | head -c 1200
echo ""

echo ""
echo "=== escalation direct (tenant 1, with svc token) ==="
ESC_TOKEN=$(grep '^ESCALATION_TOKEN=' .env | cut -d= -f2-)
curl -s -o /tmp/esc1.json -w "HTTP %{http_code}\n" \
  -H "Authorization: Bearer ${ESC_TOKEN}" \
  -H "x-blinkone-tenant-id: 1" \
  http://127.0.0.1:8797/v1/rulesets
head -c 600 /tmp/esc1.json
echo ""

echo ""
echo "=== gateway proxy (localhost) ==="
GW_TOKEN=$(grep '^GATEWAY_JWT=' .env 2>/dev/null | cut -d= -f2- || true)
curl -s -o /tmp/esc-gw.json -w "HTTP %{http_code}\n" \
  -H "Authorization: Bearer ${ESC_TOKEN}" \
  -H "x-blinkone-tenant-id: 1" \
  http://127.0.0.1:8787/api/escalations/v1/rulesets 2>/dev/null || echo "gateway curl skipped"
head -c 400 /tmp/esc-gw.json 2>/dev/null || true
echo ""

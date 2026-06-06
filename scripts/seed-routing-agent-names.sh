#!/usr/bin/env bash
# Sync routing_agents.display_name from real Chatwoot profile names.
set -euo pipefail
cd "${BLINKONE_ROOT:-/opt/blinkone}"

echo "=== Chatwoot users (account 1) ==="
USERS=$(
  docker compose exec -T postgres psql -U postgres -d chatwoot -t -A -F'|' -c \
    "SELECT u.id::text,
            COALESCE(NULLIF(TRIM(u.display_name), ''), u.name),
            u.email
     FROM users u
     JOIN account_users au ON au.user_id = u.id AND au.account_id = 1
     ORDER BY u.id;" 2>/dev/null | grep -E '^[0-9]+\|' || true
)
echo "$USERS"

echo "=== Update routing_agents + backfill call history ==="
while IFS='|' read -r cw_id display_name email; do
  [ -z "$cw_id" ] && continue
  safe_name=${display_name//\'/\'\'}

  # Match routing row by desk id OR chatwoot user id
  docker compose exec -T postgres_app psql -U app -d blinkone_app -q -c \
    "UPDATE routing_agents
     SET display_name = '${safe_name}',
         chatwoot_user_id = '${cw_id}'
     WHERE tenant_id = '1'
       AND (agent_id = '${cw_id}' OR chatwoot_user_id = '${cw_id}');" 2>/dev/null || true

  # Create routing row if missing (Chatwoot agent without routing registration)
  docker compose exec -T postgres_app psql -U app -d blinkone_app -q -c \
    "INSERT INTO routing_agents (tenant_id, agent_id, display_name, chatwoot_user_id)
     SELECT '1', '${cw_id}', '${safe_name}', '${cw_id}'
     WHERE NOT EXISTS (
       SELECT 1 FROM routing_agents
       WHERE tenant_id = '1' AND (agent_id = '${cw_id}' OR chatwoot_user_id = '${cw_id}')
     );" 2>/dev/null || true

  echo "  synced Chatwoot user ${cw_id} (${email}) -> ${display_name}"
done <<< "$USERS"

docker compose exec -T postgres_app psql -U app -d blinkone_app -v ON_ERROR_STOP=1 <<'SQL'
UPDATE call_sessions cs
SET agent_label = ra.display_name
FROM routing_agents ra
WHERE cs.tenant_id = ra.tenant_id
  AND cs.assigned_agent_id = ra.agent_id
  AND ra.display_name IS NOT NULL
  AND TRIM(ra.display_name) <> '';

SELECT agent_id, display_name, chatwoot_user_id FROM routing_agents WHERE tenant_id = '1' ORDER BY agent_id;
SQL

echo "=== Done ==="

#!/bin/bash
# Fix corrupted routing agent keys in Redis (tenant 1).
set -euo pipefail
TENANT="${SEED_TENANT:-1}"
for ID in ${AGENT_IDS:-1 2 3}; do
  JSON=$(cat <<EOF
{"agentId":"${ID}","tenantId":"${TENANT}","status":"available","currentCallId":null,"lastIdleAt":"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)","skills":["support"],"agentSkills":[{"skill":"support","proficiency":3}],"queueKeys":["support","default"],"occupancy":0,"updatedAt":"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"}
EOF
)
  docker compose -f /opt/blinkone/docker-compose.yml exec -T redis redis-cli SET "t:${TENANT}:routing:agent:${ID}" "$JSON" >/dev/null
  echo "redis agent ${ID} → available"
done
docker compose -f /opt/blinkone/docker-compose.yml exec -T redis redis-cli DEL "t:${TENANT}:routing:queue:support" 2>/dev/null || true
echo "queue support cleared"

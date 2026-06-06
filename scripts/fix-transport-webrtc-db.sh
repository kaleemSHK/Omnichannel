#!/bin/bash
set -euo pipefail
docker compose -f /opt/blinkone/docker-compose.yml exec -T postgres_app psql -U app -d blinkone_app <<'SQL'
ALTER TABLE call_sessions DROP CONSTRAINT IF EXISTS call_sessions_transport_check;
ALTER TABLE call_sessions ADD CONSTRAINT call_sessions_transport_check
  CHECK (transport IN ('pstn', 'whatsapp', 'webrtc'));
SQL
echo "transport constraint updated"

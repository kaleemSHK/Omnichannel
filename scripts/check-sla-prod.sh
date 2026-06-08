#!/usr/bin/env bash
set -euo pipefail
docker exec blinkone-postgres_app-1 psql -U app -d blinkone_app -c "SELECT count(*) AS policies FROM sla_policies;"
docker exec blinkone-postgres_app-1 psql -U app -d blinkone_app -c "SELECT count(*) AS instances FROM sla_instances;"
docker exec blinkone-postgres_app-1 psql -U app -d blinkone_app -c "SELECT id, tenant_id, name, is_default, enabled FROM sla_policies;"
docker exec blinkone-postgres_app-1 psql -U app -d blinkone_app -c "SELECT p.name, t.target_type, t.threshold_minutes FROM sla_targets t JOIN sla_policies p ON p.id=t.policy_id WHERE p.tenant_id='1' ORDER BY p.name, t.target_type;"

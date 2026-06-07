#!/usr/bin/env bash
cd /opt/blinkone
docker compose exec -T postgres_app psql -U app -d blinkone_app <<'SQL'
SELECT tenant_id, name FROM escalation_rulesets WHERE tenant_id='1';
SELECT r.name, r.trigger FROM escalation_rules r
JOIN escalation_rulesets s ON s.id = r.ruleset_id WHERE s.tenant_id='1';
SQL

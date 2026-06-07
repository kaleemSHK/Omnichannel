#!/usr/bin/env bash
docker exec blinkone-postgres_app-1 psql -U app -d blinkone_app -c "DELETE FROM sla_events WHERE instance_id IN (SELECT id FROM sla_instances WHERE tenant_id = '1' AND conversation_id = 999);"
docker exec blinkone-postgres_app-1 psql -U app -d blinkone_app -c "DELETE FROM sla_instances WHERE tenant_id = '1' AND conversation_id = 999;"
docker exec blinkone-postgres_app-1 psql -U app -d blinkone_app -c "SELECT count(*) AS conv999 FROM sla_instances WHERE conversation_id = 999;"
docker exec blinkone-postgres_app-1 psql -U app -d blinkone_app -c "SELECT count(*) AS total FROM sla_instances WHERE tenant_id = '1';"

#!/usr/bin/env bash
docker exec blinkone-postgres_app-1 psql -U app -d blinkone_app -c "SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname='app';"
docker exec blinkone-postgres_app-1 psql -U app -d blinkone_app -c "SELECT policyname, qual FROM pg_policies WHERE tablename='sla_policies';"
docker exec blinkone-postgres_app-1 psql -U app -d blinkone_app -c "SELECT DISTINCT tenant_id FROM sla_policies;"

#!/usr/bin/env bash
set -uo pipefail
PSQL='docker exec blinkone-postgres_app-1 psql -U app -d blinkone_app -tAc'
echo "=== matching tables ==="
$PSQL "select table_name from information_schema.tables where table_schema='public' and (table_name ilike '%cdr%' or table_name ilike '%record%' or table_name ilike '%call%' or table_name ilike '%session%') order by 1;" 2>&1
echo "=== counts ==="
for t in cdr call_sessions calls recordings call_recordings; do
  n=$($PSQL "select count(*) from $t" 2>/dev/null)
  echo "$t = ${n:-n/a}"
done
echo "=== recent cdr sample ==="
$PSQL "select id, direction, from_number, to_number, duration_sec, outcome, created_at from cdr order by created_at desc limit 5" 2>&1 | head
echo "CNT-DONE"

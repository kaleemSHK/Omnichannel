#!/usr/bin/env bash
set -uo pipefail
echo "=== frontend demo flag ==="
grep -E 'NEXT_PUBLIC_USE_DEMO_DATA|NEXT_PUBLIC_API_BASE' /opt/blinkone/frontend/.env.production 2>/dev/null || echo "(no .env.production)"
echo
echo "=== postgres container ==="
PG=$(docker ps --format '{{.Names}}' | grep -iE 'postgres|pg|db' | head -1)
echo "pg=$PG"
echo
echo "=== calls service DB / tables ==="
for c in $(docker ps --format '{{.Names}}' | grep -iE 'calls|recording'); do
  echo "--- $c env (db) ---"
  docker exec "$c" sh -c 'env | grep -iE "DATABASE_URL|PG|DB_" | sed -E "s/(password|:[^@/]*@)/****@/I"' 2>/dev/null | head
done
echo
if [ -n "$PG" ]; then
  echo "=== row counts ==="
  docker exec "$PG" psql -U postgres -d blinkone -tAc "select 'cdr', count(*) from cdr" 2>/dev/null || \
  docker exec "$PG" psql -U postgres -tAc "\dt" 2>/dev/null | grep -iE 'cdr|recording|call' | head
fi
echo "CALLDATA-DONE"

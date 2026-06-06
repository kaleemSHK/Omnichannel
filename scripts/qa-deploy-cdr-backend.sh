#!/usr/bin/env bash
# Hot-deploy the enriched cdr-repo.js into the running calls container.
set -uo pipefail
C=blinkone-calls-1
echo "=== copying cdr-repo.js into $C ==="
docker cp /tmp/cdr-repo.js "$C":/app/lib/cdr-repo.js
echo "=== syntax check ==="
docker exec "$C" node --check /app/lib/cdr-repo.js && echo "syntax OK"
echo "=== restart ==="
docker restart "$C" >/dev/null
sleep 3
docker ps --filter "name=$C" --format '{{.Names}} {{.Status}}'
echo "=== recent log ==="
docker logs --tail 8 "$C" 2>&1 | tail -8
echo "CDR-BACKEND-DONE"

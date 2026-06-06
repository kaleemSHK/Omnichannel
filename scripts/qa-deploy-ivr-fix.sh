#!/usr/bin/env bash
# Hot-deploy IVR getFlow UUID guard + route try/catch into the running ivr container.
set -uo pipefail
C=blinkone-ivr-1
echo "=== copying files into $C ==="
docker cp /tmp/ivr-flow-repo.js "$C":/app/lib/flow-repo.js
docker cp /tmp/ivr-server.js    "$C":/app/src/server.js
echo "=== syntax check ==="
docker exec "$C" node --check /app/lib/flow-repo.js && echo "flow-repo OK"
docker exec "$C" node --check /app/src/server.js && echo "server OK"
echo "=== restart ==="
docker restart "$C" >/dev/null
sleep 3
docker inspect "$C" --format 'restarts={{.RestartCount}} state={{.State.Status}}'
echo "=== probe invalid id (should be 404, not crash) ==="
docker exec "$C" sh -c 'wget -qO- --server-response http://127.0.0.1:8795/v1/flows/flow-demo-1 2>&1 | grep -E "HTTP/|NOT_FOUND" | head' 2>/dev/null
echo "=== probe list flows ==="
docker exec "$C" sh -c 'wget -qO- http://127.0.0.1:8795/v1/flows 2>/dev/null | head -c 200' 2>/dev/null
echo
echo "=== log tail ==="
docker logs --tail 6 "$C" 2>&1 | tail -6
echo "IVR-FIX-DONE"

#!/usr/bin/env bash
set -uo pipefail
C=blinkone-ivr-1
echo "=== container status ==="
docker ps -a --filter "name=$C" --format '{{.Names}} | {{.Status}} | {{.Image}}'
echo
echo "=== restart count / health ==="
docker inspect "$C" --format 'restarts={{.RestartCount}} state={{.State.Status}} oom={{.State.OOMKilled}} exit={{.State.ExitCode}}' 2>/dev/null
echo
echo "=== last 40 log lines ==="
docker logs --tail 40 "$C" 2>&1 | tail -40
echo
echo "=== local health probe ==="
docker exec "$C" sh -c 'wget -qO- http://127.0.0.1:8793/health 2>/dev/null || wget -qO- http://127.0.0.1:8791/health 2>/dev/null || echo "no /health on 8793/8791"' 2>/dev/null
echo
echo "=== flows route probe (in-container) ==="
docker exec "$C" sh -c 'for p in 8793 8791 8080; do echo "port $p:"; wget -qO- http://127.0.0.1:$p/v1/flows 2>/dev/null | head -c 300; echo; done' 2>/dev/null
echo "IVR-DIAG-DONE"

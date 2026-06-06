#!/usr/bin/env bash
set -euo pipefail
cd /opt/blinkone

OVERRIDE=docker-compose.override.yml
STAMP=$(date +%Y%m%d-%H%M%S)
cp "$OVERRIDE" "${OVERRIDE}.bak-${STAMP}"

echo "=== ensure JWT_SECRET present in .env ==="
if ! grep -q '^JWT_SECRET=' .env; then
  echo "!! JWT_SECRET missing from .env — cannot verify gateway JWTs"; exit 1
fi

echo "=== add JWT_SECRET to routing via override (idempotent) ==="
if grep -qE '^\s+routing:' "$OVERRIDE" && grep -q 'JWT_SECRET' "$OVERRIDE"; then
  echo "routing JWT_SECRET already in override; skipping."
else
  cat >> "$OVERRIDE" <<'YAML'

  routing:
    environment:
      JWT_SECRET: ${JWT_SECRET}
YAML
  echo "appended routing JWT_SECRET to override."
fi

echo
echo "=== validate merged routing env ==="
docker compose config 2>/dev/null \
  | awk '/^  routing:/{f=1} f&&/^  [a-z][a-z_-]*:/&&!/^  routing:/{exit} f{print}' \
  | grep -Ei 'JWT_SECRET' | sed -E 's/(JWT_SECRET:).*/\1 <redacted-present>/'

echo
echo "=== rebuild + recreate routing ==="
docker compose build routing >/dev/null 2>&1 && echo built
docker compose up -d --force-recreate routing
sleep 5
docker compose ps routing

echo
echo "=== mint a short test gateway JWT (HS256, iss=blinkone-gateway) and test handshake ==="
JWT_SECRET=$(grep '^JWT_SECRET=' .env | cut -d= -f2-)
TESTJWT=$(JWT_SECRET="$JWT_SECRET" docker compose exec -T routing node -e '
const c=require("crypto");
const s=process.env.JWT_SECRET;
const enc=o=>Buffer.from(JSON.stringify(o)).toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const h=enc({alg:"HS256",typ:"JWT"});
const now=Math.floor(Date.now()/1000);
const p=enc({sub:"1",tenant_id:"1",roles:["admin"],account_id:1,iat:now,exp:now+300,iss:"blinkone-gateway"});
const sig=c.createHmac("sha256",s).update(h+"."+p).digest("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
process.stdout.write(h+"."+p+"."+sig);
' 2>/dev/null)
echo "test jwt len=${#TESTJWT}"

echo "-- handshake with valid JWT (expect 101) --"
docker compose exec -T routing sh -lc "wget -qS -O- --header='Upgrade: websocket' --header='Connection: Upgrade' --header='Sec-WebSocket-Version: 13' --header='Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' 'http://127.0.0.1:8798/v1/realtime?tenant_id=1&token=$TESTJWT' 2>&1 | grep -i 'HTTP/' | head -1"

echo "-- handshake with bogus token (expect 401) --"
docker compose exec -T routing sh -lc "wget -qS -O- --header='Upgrade: websocket' --header='Connection: Upgrade' --header='Sec-WebSocket-Version: 13' --header='Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' 'http://127.0.0.1:8798/v1/realtime?tenant_id=1&token=bogus' 2>&1 | grep -i 'HTTP/' | head -1"

echo
echo "=== public path via ws.blinksone.com with valid JWT (expect 101) ==="
curl -s -i -k --max-time 8 -H "Upgrade: websocket" -H "Connection: Upgrade" -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" "https://ws.blinksone.com/ws/routing/v1/realtime?tenant_id=1&token=$TESTJWT" 2>&1 | grep -iE 'HTTP/' | head -1

echo DONE-ROUTING-WS

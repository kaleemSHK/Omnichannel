#!/usr/bin/env bash
set -euo pipefail
cd /opt/blinkone

cp docker-compose.override.yml "docker-compose.override.yml.fix-$(date +%Y%m%d-%H%M%S)"

cat > docker-compose.override.yml <<'YAML'
services:
  chatwoot:
    image: blinkone/chatwoot:v4.13.0-ce-slim
    build: !reset null
  sidekiq:
    image: blinkone/chatwoot:v4.13.0-ce-slim
    build: !reset null

  gateway:
    ports:
      - 127.0.0.1:8787:8787

  tickets:
    ports:
      - 127.0.0.1:8791:8791

  sla:
    ports:
      - 127.0.0.1:8796:8796

  escalation:
    ports:
      - 127.0.0.1:8797:8797

  routing:
    ports:
      - 127.0.0.1:8798:8798
    environment:
      JWT_SECRET: ${JWT_SECRET}

  ivr:
    environment:
      TENANT_URL: http://tenant:8802
      TENANT_TOKEN: ${TENANT_TOKEN:-${PLATFORM_TOKEN}}
      FEATURE_FAILOPEN: ${FEATURE_FAILOPEN:-1}
YAML

echo "=== validate merged compose (routing + ivr env) ==="
docker compose config >/dev/null 2>&1 && echo "compose config OK" || { echo "compose config FAILED"; docker compose config 2>&1 | tail -15; exit 1; }
docker compose config 2>/dev/null | awk '/^  routing:/{f=1} f&&/^  [a-z][a-z_-]*:/&&!/^  routing:/{exit} f{print}' | grep -Ei 'JWT_SECRET|8798' | sed -E 's/(JWT_SECRET:).*/\1 <present>/'

echo
echo "=== recreate routing ==="
docker compose up -d --force-recreate routing
sleep 5
docker compose ps routing
docker compose exec -T routing printenv 2>/dev/null | grep -E 'JWT_SECRET' | sed -E 's/=.*/=<present>/' || echo "JWT_SECRET MISSING"

JWT_SECRET=$(grep '^JWT_SECRET=' .env | cut -d= -f2-)
TESTJWT=$(JWT_SECRET="$JWT_SECRET" docker compose exec -T routing node -e '
const c=require("crypto");const s=process.env.JWT_SECRET;
const enc=o=>Buffer.from(JSON.stringify(o)).toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const h=enc({alg:"HS256",typ:"JWT"});const now=Math.floor(Date.now()/1000);
const p=enc({sub:"1",tenant_id:"1",roles:["admin"],account_id:1,iat:now,exp:now+300,iss:"blinkone-gateway"});
const sig=c.createHmac("sha256",s).update(h+"."+p).digest("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
process.stdout.write(h+"."+p+"."+sig);' 2>/dev/null)

echo
echo "-- internal handshake with VALID jwt (expect 101) --"
docker compose exec -T routing sh -lc "wget -qS -O- --header='Upgrade: websocket' --header='Connection: Upgrade' --header='Sec-WebSocket-Version: 13' --header='Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' 'http://127.0.0.1:8798/v1/realtime?tenant_id=1&token=$TESTJWT' 2>&1 | grep -i 'HTTP/' | head -1"
echo "-- internal handshake with BOGUS token (expect 401) --"
docker compose exec -T routing sh -lc "wget -qS -O- --header='Upgrade: websocket' --header='Connection: Upgrade' --header='Sec-WebSocket-Version: 13' --header='Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' 'http://127.0.0.1:8798/v1/realtime?tenant_id=1&token=bogus' 2>&1 | grep -i 'HTTP/' | head -1"
echo "-- public via ws.blinksone.com with VALID jwt (expect 101) --"
curl -s -i -k --max-time 8 -H "Upgrade: websocket" -H "Connection: Upgrade" -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" "https://ws.blinksone.com/ws/routing/v1/realtime?tenant_id=1&token=$TESTJWT" 2>&1 | grep -iE 'HTTP/' | head -1
echo DONE-ROUTING-WS-FIX

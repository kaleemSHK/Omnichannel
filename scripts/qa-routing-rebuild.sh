#!/usr/bin/env bash
set -euo pipefail
cd /opt/blinkone

echo "=== confirm new code is in source tree ==="
grep -c verifyGatewayJwt services/routing/lib/realtime-ws.js || echo "MISSING IN SOURCE"

echo
echo "=== rebuild routing image ==="
docker compose build routing
docker compose up -d --force-recreate routing
sleep 5

echo "=== confirm new code baked into image ==="
docker compose exec -T routing sh -lc "grep -c verifyGatewayJwt lib/realtime-ws.js 2>/dev/null || grep -rc verifyGatewayJwt /app 2>/dev/null | head -1"

JWT_SECRET=$(grep '^JWT_SECRET=' .env | cut -d= -f2-)
TESTJWT=$(JWT_SECRET="$JWT_SECRET" docker compose exec -T routing node -e '
const c=require("crypto");const s=process.env.JWT_SECRET;
const enc=o=>Buffer.from(JSON.stringify(o)).toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const h=enc({alg:"HS256",typ:"JWT"});const now=Math.floor(Date.now()/1000);
const p=enc({sub:"1",tenant_id:"1",roles:["admin"],account_id:1,iat:now,exp:now+300,iss:"blinkone-gateway"});
const sig=c.createHmac("sha256",s).update(h+"."+p).digest("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
process.stdout.write(h+"."+p+"."+sig);' 2>/dev/null)
echo "test jwt len=${#TESTJWT}"

echo
echo "-- VALID jwt (expect 101) --"
docker compose exec -T routing sh -lc "wget -qS -O- --header='Upgrade: websocket' --header='Connection: Upgrade' --header='Sec-WebSocket-Version: 13' --header='Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' 'http://127.0.0.1:8798/v1/realtime?tenant_id=1&token=$TESTJWT' 2>&1 | grep -i 'HTTP/' | head -1"
echo "-- BOGUS token (expect 401) --"
docker compose exec -T routing sh -lc "wget -qS -O- --header='Upgrade: websocket' --header='Connection: Upgrade' --header='Sec-WebSocket-Version: 13' --header='Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' 'http://127.0.0.1:8798/v1/realtime?tenant_id=1&token=bogus' 2>&1 | grep -i 'HTTP/' | head -1"
echo "-- public ws.blinksone.com VALID jwt (expect 101) --"
curl -s -i -k --max-time 8 -H "Upgrade: websocket" -H "Connection: Upgrade" -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" "https://ws.blinksone.com/ws/routing/v1/realtime?tenant_id=1&token=$TESTJWT" 2>&1 | grep -iE 'HTTP/' | head -1
echo DONE-ROUTING-REBUILD

#!/usr/bin/env bash
set -euo pipefail
cd /opt/blinkone

TOKEN=$(curl -sf -X POST http://127.0.0.1:3000/auth/sign_in \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@blinksone.com","password":"Demo@2026!"}' \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["access_token"])')

ACCOUNT=$(curl -sf -X POST http://127.0.0.1:3000/auth/sign_in \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@blinksone.com","password":"Demo@2026!"}' \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["account_id"])')

echo "account_id=$ACCOUNT token_len=${#TOKEN}"

for path in \
  "http://127.0.0.1:3000/api/v1/accounts/${ACCOUNT}/conversations?status=open" \
  "http://127.0.0.1:3000/api/v2/accounts/${ACCOUNT}/conversations?status=open" \
  "http://127.0.0.1:3001/_cw/api/v1/accounts/${ACCOUNT}/conversations?status=open" \
  "https://app.blinksone.com/_cw/api/v1/accounts/${ACCOUNT}/conversations?status=open"; do
  echo "--- $path"
  code=$(curl -sk -o /tmp/cw_conv.json -w '%{http_code}' -H "api_access_token: ${TOKEN}" "$path")
  echo "HTTP $code"
  python3 <<'PY' || true
import json
raw=open('/tmp/cw_conv.json').read()
try:
    d=json.loads(raw)
except Exception:
    print('parse fail', raw[:200])
    raise SystemExit(0)
print('keys', list(d.keys()) if isinstance(d,dict) else type(d))
if isinstance(d,dict):
    if 'data' in d and isinstance(d['data'],dict):
        p=d['data'].get('payload',[])
        print('data.payload len', len(p))
    elif 'payload' in d:
        print('payload len', len(d['payload']))
    else:
        print('sample', str(d)[:300])
PY
done

echo "--- routes-manifest gateway upstream"
python3 -c "import json; m=json.load(open('/opt/blinkone/frontend/.next/routes-manifest.json')); print([r for r in m.get('rewrites',[]) if '_cw' in str(r)][:2])" 2>/dev/null || echo "no manifest"

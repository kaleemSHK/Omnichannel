#!/usr/bin/env bash
# Proxy /twilio/* to Chatwoot (Twilio SMS webhooks). Next.js was returning 404.
set -euo pipefail
CFG="${1:-/etc/nginx/sites-available/blinkone}"
cp "$CFG" "${CFG}.bak.twilio.$(date +%s)"
python3 <<PY
from pathlib import Path
p = Path("${CFG}")
t = p.read_text()
old = "location ~ ^/(api/v1|api/v2|auth|cable|rails)/ {"
new = "location ~ ^/(api/v1|api/v2|auth|cable|rails|twilio)/ {"
if "twilio)/" in t and old not in t:
    print("already patched")
elif old not in t:
    raise SystemExit("nginx pattern not found — edit manually")
else:
    p.write_text(t.replace(old, new, 1))
    print(f"patched {p}")
PY
nginx -t
systemctl reload nginx
echo "Testing POST /twilio/callback ..."
code=$(curl -sk -o /tmp/twilio-cb.body -w '%{http_code}' -X POST \
  -H 'Host: app.blinksone.com' \
  -d 'SmsStatus=received&Body=test' \
  https://127.0.0.1/twilio/callback)
echo "HTTP $code"
head -c 120 /tmp/twilio-cb.body || true
echo

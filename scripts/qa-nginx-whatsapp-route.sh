#!/usr/bin/env bash
set -euo pipefail
CONF=/etc/nginx/sites-enabled/blinkone
python3 - <<'PY'
from pathlib import Path
p = Path("/etc/nginx/sites-enabled/blinkone")
text = p.read_text()
old = "location ~ ^/api/(auth|routing|calls|tickets|ai|billing|sla|escalation|recording|integration|tenant|platform|ivr)/ {"
new = "location ~ ^/api/(auth|routing|calls|tickets|ai|billing|sla|escalation|recording|integration|tenant|platform|ivr|whatsapp-calls)/ {"
if new in text:
    print("already patched")
elif old in text:
    p.write_text(text.replace(old, new))
    print("patched")
else:
    raise SystemExit("pattern not found")
PY
nginx -t
systemctl reload nginx
curl -s -o /dev/null -w "public whatsapp-calls: HTTP %{http_code}\n" https://app.blinksone.com/api/whatsapp-calls/v1/config
echo DONE-NGINX-WHATSAPP

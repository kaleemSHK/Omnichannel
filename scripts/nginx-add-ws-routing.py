#!/usr/bin/env python3
from pathlib import Path

p = Path('/etc/nginx/sites-available/blinkone')
t = p.read_text()
block = """    location /ws/routing/ {
        proxy_pass http://127.0.0.1:8798/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

"""
needle = "    location / {\n        proxy_pass http://localhost:3001;"
if 'location /ws/routing/' not in t:
    if needle not in t:
        raise SystemExit('needle not found in nginx config')
    t = t.replace(needle, block + needle)
    p.write_text(t)
    print('nginx updated')
else:
    print('already present')

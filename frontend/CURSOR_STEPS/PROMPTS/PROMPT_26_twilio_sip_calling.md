# PROMPT 26 — Twilio SIP Calling — Live Setup
## BlinkOne · blinksone.com · Hetzner CPX32

This prompt wires real browser-based calling using your **Twilio Elastic SIP Trunk**.
Agents will make and receive calls directly in the BlinkOne browser UI — no softphone needed.

### Your Twilio Config Summary
| Item | Value |
|------|-------|
| Trunk name | intelysys |
| Trunk SID | TK30b0b317d0d042ac995d7e1267e6dd12 |
| Termination URI | intelysys.pstn.twilio.com |
| SIP Username | blinkone |
| SIP Password | BlinkSip2026! |
| DID (phone number) | +1 (914) 303-8893 |
| WSS endpoint | wss://sip.twilio.com:5061 |

---

## PART A — Twilio Console: Origination URI (tell Twilio where to send inbound calls)

In Twilio Console → your trunk → **Origination** tab:

1. Click **"Add new Origination URI"**
2. Set:
   - **SIP URI**: `sip:204.168.137.104:5060`
   - **Priority**: `10`
   - **Weight**: `10`
3. Click **Save**

> This tells Twilio: when someone calls +1 (914) 303-8893, forward it to your server at 204.168.137.104.

---

## PART B — Twilio Console: Firewall — Whitelist Twilio IPs

Twilio sends SIP from specific IP ranges. Your server firewall must allow them.

Run this on the server (`ssh root@204.168.137.104`):

```bash
# Allow Twilio SIP signaling IPs (UDP + TCP port 5060/5061)
ufw allow from 54.172.60.0/23 to any port 5060 proto udp comment "Twilio SIP US1"
ufw allow from 54.244.51.0/24 to any port 5060 proto udp comment "Twilio SIP US-West"
ufw allow from 54.171.127.192/26 to any port 5060 proto udp comment "Twilio SIP EU"
ufw allow from 35.156.191.128/25 to any port 5060 proto udp comment "Twilio SIP EU-Frankfurt"

# Allow Twilio RTP media (audio packets) — wide range needed
ufw allow from 54.172.60.0/23 to any proto udp comment "Twilio RTP media"
ufw allow from 54.244.51.0/24 to any proto udp comment "Twilio RTP media"

# Also open SIP port generally (needed for JsSIP WebSocket registration)
ufw allow 5060/udp comment "SIP UDP"
ufw allow 5061/tcp comment "SIP TLS"

ufw status numbered
echo "✅ Twilio IPs whitelisted"
```

---

## PART C — Server: Install & Configure Kamailio (SIP proxy)

JsSIP in the browser connects via **WebSocket (WSS)**. Twilio connects via **UDP SIP**.
Kamailio bridges between them — it receives the browser WebSocket and forwards to Twilio PSTN.

```bash
# Install Kamailio
apt update
apt install -y kamailio kamailio-websocket-modules kamailio-tls-modules \
               kamailio-extra-modules kamailio-utils-modules

# Verify install
kamailio -V | head -3
echo "✅ Kamailio installed"
```

### Configure Kamailio

```bash
# Backup default config
cp /etc/kamailio/kamailio.cfg /etc/kamailio/kamailio.cfg.bak

# Write BlinkOne config
cat > /etc/kamailio/kamailio.cfg << 'KAMAILIO_EOF'
#!KAMAILIO

####### Global Parameters #######
debug=2
log_stderror=no
log_facility=LOG_LOCAL0
fork=yes
children=4

# Network
listen=udp:0.0.0.0:5060
listen=tcp:0.0.0.0:5060
listen=tls:0.0.0.0:5061
listen=ws:0.0.0.0:8088
listen=wss:0.0.0.0:8089

# TLS (reuse Let's Encrypt certs)
enable_tls=1

###### Module Imports ######
loadmodule "tm.so"
loadmodule "sl.so"
loadmodule "rr.so"
loadmodule "pv.so"
loadmodule "maxfwd.so"
loadmodule "usrloc.so"
loadmodule "registrar.so"
loadmodule "textops.so"
loadmodule "siputils.so"
loadmodule "xlog.so"
loadmodule "sanity.so"
loadmodule "ctl.so"
loadmodule "cfg_rpc.so"
loadmodule "acc.so"
loadmodule "auth.so"
loadmodule "auth_db.so"
loadmodule "websocket.so"
loadmodule "nathelper.so"
loadmodule "tls.so"
loadmodule "htable.so"

###### Module Parameters ######
modparam("usrloc", "db_mode", 0)
modparam("registrar", "method_filtering", 1)
modparam("registrar", "max_expires", 3600)

# TLS config
modparam("tls", "config", "/etc/kamailio/tls.cfg")

# Websocket
modparam("websocket", "keepalive_mechanism", 1)
modparam("websocket", "keepalive_timeout", 30)

# NAT
modparam("nathelper", "natping_interval", 30)
modparam("nathelper", "ping_nated_only", 1)

####### Routing Logic #######
request_route {
    # Max forwards check
    if (!mf_process_maxfwd_header("10")) {
        sl_send_reply("483","Too Many Hops");
        exit;
    }

    # Sanity checks
    if (!sanity_check()) {
        xlog("Malformed SIP request from $si\n");
        exit;
    }

    # Handle WebSocket
    if (nat_uac_test("64")) {
        if (is_method("REGISTER")) {
            fix_nated_register();
        } else {
            fix_nated_contact();
        }
    }

    # WebSocket handshake
    if (is_method("OPTIONS") && proto == WS) {
        sl_send_reply("200","Keepalive");
        exit;
    }

    # Record route for in-dialog requests
    if (!is_method("REGISTER|MESSAGE")) {
        record_route();
    }

    # Handle REGISTER — browser agents registering
    if (is_method("REGISTER")) {
        if (!save("location")) {
            sl_reply_error();
        }
        exit;
    }

    # Route in-dialog requests
    if (has_totag()) {
        if (loose_route()) {
            route(RELAY);
        } else {
            sl_send_reply("404","Not here");
        }
        exit;
    }

    # Route INVITE — outbound (browser → Twilio PSTN)
    if (is_method("INVITE")) {
        # Forward to Twilio trunk
        rewritehostport("intelysys.pstn.twilio.com");
        route(RELAY);
        exit;
    }

    # Lookup registered contacts (inbound from Twilio → browser)
    if (!lookup("location")) {
        sl_send_reply("404","User Not Found");
        exit;
    }

    route(RELAY);
}

route[RELAY] {
    if (!t_relay()) {
        sl_reply_error();
    }
    exit;
}

onreply_route {
    if (nat_uac_test("64")) {
        fix_nated_contact();
    }
}
KAMAILIO_EOF

echo "✅ Kamailio config written"
```

### Configure Kamailio TLS (reuse Let's Encrypt certs)

```bash
cat > /etc/kamailio/tls.cfg << 'TLS_EOF'
[server:default]
method = TLSv1.2+
verify_certificate = no
require_certificate = no
private_key = /etc/letsencrypt/live/blinksone.com/privkey.pem
certificate = /etc/letsencrypt/live/blinksone.com/fullchain.pem
TLS_EOF

echo "✅ TLS config written"
```

### Start Kamailio

```bash
# Test config
kamailio -c -f /etc/kamailio/kamailio.cfg

# Enable and start
systemctl enable kamailio
systemctl start kamailio
systemctl status kamailio

# Verify ports are listening
ss -tlnup | grep -E "5060|5061|8088|8089"
echo "✅ Kamailio running"
```

---

## PART D — Update Nginx: proxy WSS → Kamailio

The browser connects to `wss://app.blinksone.com/sip` — Nginx proxies it to Kamailio's WS port.

```bash
# Add WSS proxy block to Nginx config
# Insert BEFORE the final 'location /' block

cat >> /tmp/nginx_sip_block.txt << 'NGINX_EOF'

    # SIP WebSocket — proxy to Kamailio WSS
    location /sip {
        proxy_pass http://127.0.0.1:8088;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
NGINX_EOF

# Show what to add
cat /tmp/nginx_sip_block.txt
```

Now add it to the Nginx config — insert it BEFORE `location / {`:

```bash
# Add the SIP location block before the frontend proxy
sed -i '/# Next.js frontend/i\    # SIP WebSocket — proxy to Kamailio\n    location \/sip {\n        proxy_pass http:\/\/127.0.0.1:8088;\n        proxy_http_version 1.1;\n        proxy_set_header Upgrade $http_upgrade;\n        proxy_set_header Connection "upgrade";\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_read_timeout 3600s;\n        proxy_send_timeout 3600s;\n    }\n' /etc/nginx/sites-available/blinkone

nginx -t && systemctl reload nginx
echo "✅ Nginx SIP proxy added"
```

---

## PART E — Update Frontend `.env.production` on Server

The frontend needs to point at the WSS endpoint via Nginx (not direct Kamailio port):

```bash
cat > /opt/blinkone/frontend/.env.production << 'ENV_EOF'
NEXT_PUBLIC_CHATWOOT_URL=https://app.blinksone.com
NEXT_PUBLIC_API_BASE=https://app.blinksone.com
NEXT_PUBLIC_WS_URL=wss://app.blinksone.com/cable

# Twilio Elastic SIP Trunk via Kamailio WSS bridge
NEXT_PUBLIC_SIP_WSS=wss://app.blinksone.com/sip
NEXT_PUBLIC_SIP_DOMAIN=intelysys.pstn.twilio.com
NEXT_PUBLIC_SIP_USER=blinkone
NEXT_PUBLIC_SIP_PASS=BlinkSip2026!

NEXT_PUBLIC_USE_DEMO_DATA=false
ENV_EOF

echo "✅ Frontend .env.production updated"
```

### Rebuild and restart the frontend

```bash
cd /opt/blinkone/frontend
npm run build
pm2 restart blinkone-frontend
pm2 save
echo "✅ Frontend rebuilt with SIP config"
```

---

## PART F — Test Calling End-to-End

### Test 1: Kamailio is accepting WebSocket connections

```bash
# From server
curl -i -N -H "Connection: Upgrade" \
     -H "Upgrade: websocket" \
     -H "Host: localhost" \
     -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
     -H "Sec-WebSocket-Version: 13" \
     http://localhost:8088/

# Expected: 101 Switching Protocols
```

### Test 2: SIP registration from browser

1. Open https://app.blinksone.com/login
2. Log in as `admin@blinksone.com / Demo@2026!`
3. Open browser DevTools → Console
4. Look for: `JsSIP: UA registered` — this confirms the browser SIP UA registered with Kamailio

### Test 3: Make an outbound call

1. In the BlinkOne UI, go to **Calling** module
2. Click the dialpad, enter any Pakistani number e.g. `+923001234567`
3. Click Call — you should hear ringing
4. The call routes: Browser → WSS → Kamailio → Twilio → PSTN

### Test 4: Receive an inbound call

Call **(914) 303-8893** from any phone.
Twilio sends the INVITE to your server (204.168.137.104:5060).
Kamailio routes it to the registered browser agent.
The BlinkOne UI shows an incoming call notification.

---

## PART G — Verify Everything

```bash
echo "=== Kamailio Status ==="
systemctl status kamailio --no-pager

echo ""
echo "=== SIP Ports ==="
ss -tlnup | grep -E "5060|5061|8088|8089"

echo ""
echo "=== Nginx SIP proxy ==="
grep -A8 "location /sip" /etc/nginx/sites-available/blinkone

echo ""
echo "=== Frontend SIP env ==="
grep SIP /opt/blinkone/frontend/.env.production

echo ""
echo "✅ All done! Call (914) 303-8893 to test inbound"
echo "✅ Use the BlinkOne dialpad to test outbound"
```

---

## TROUBLESHOOTING

### ❌ JsSIP not registering (no "UA registered" in console)
- Check `NEXT_PUBLIC_SIP_WSS` is `wss://app.blinksone.com/sip`
- Check Nginx `/sip` proxy block is present: `grep -A5 "location /sip" /etc/nginx/sites-available/blinkone`
- Check Kamailio is running: `systemctl status kamailio`

### ❌ Outbound call fails immediately
- Check Twilio Termination URI is set: `intelysys.pstn.twilio.com`
- Check credential list `blinkone-creds` is attached to the trunk
- Check Kamailio logs: `journalctl -u kamailio -n 50`

### ❌ Inbound call not reaching browser
- Check Origination URI in Twilio: `sip:204.168.137.104:5060`
- Check UFW allows port 5060: `ufw status | grep 5060`
- Make sure agent is logged in (JsSIP only receives calls when registered)

### ❌ Audio one-way or no audio
- RTP media ports need to be open. Run:
```bash
ufw allow 10000:20000/udp comment "RTP media"
```

---

## Summary

| Part | Action | Result |
|------|--------|--------|
| A | Add Origination URI in Twilio | Inbound calls reach your server |
| B | Whitelist Twilio IPs in UFW | Firewall allows SIP traffic |
| C | Install + configure Kamailio | WSS ↔ UDP SIP bridge |
| D | Add `/sip` proxy in Nginx | Browser WSS connects via HTTPS |
| E | Update `.env.production` + rebuild | Frontend uses real SIP |
| F | End-to-end call tests | Calling is live |

**Test number: (914) 303-8893**
**Demo URL: https://app.blinksone.com**

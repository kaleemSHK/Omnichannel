# PROMPT 27 — Calling: Twilio Origination + Full E2E Verification
## BlinkOne · blinksone.com · Post-PROMPT_26

PROMPT_26 is deployed. This prompt covers the **one remaining manual step** in Twilio
and a complete end-to-end calling verification checklist.

---

## PART A — Twilio Console: Add Origination URI (MANDATORY — 2 minutes)

This is the only step that cannot be done from SSH. Without it, calls to **(914) 303-8893**
will not reach your server.

1. Go to: https://console.twilio.com → **Elastic SIP Trunking** → **intelysys** trunk
2. Click **Origination** in the left sidebar
3. Click **"Add new Origination URI"**
4. Fill in:
   - **SIP URI**: `sip:204.168.137.104:5060`
   - **Priority**: `10`
   - **Weight**: `10`
5. Click **Save**

✅ Done when you see `sip:204.168.137.104:5060` listed under Origination URIs.

---

## PART B — Server Quick Status Check

SSH in and run this one command:

```bash
ssh root@204.168.137.104

# Paste this full block:
echo "=== Kamailio ===" && systemctl is-active kamailio
echo "=== Nginx ===" && systemctl is-active nginx
echo "=== PM2 Frontend ===" && pm2 status
echo "=== SIP Ports ===" && ss -tlnup | grep -E "5060|8088"
echo "=== Nginx /sip block ===" && grep -A3 "location /sip" /etc/nginx/sites-available/blinkone
echo "=== Frontend SIP env ===" && grep SIP /opt/blinkone/frontend/.env.production
```

**Expected output:**
```
=== Kamailio ===
active
=== Nginx ===
active
=== PM2 Frontend ===
┌─ blinkone-frontend ─ online ─┐
=== SIP Ports ===
tcp  LISTEN  0.0.0.0:5060   (kamailio)
tcp  LISTEN  0.0.0.0:8088   (kamailio)
=== Nginx /sip block ===
location /sip {
    proxy_pass http://127.0.0.1:8088;
=== Frontend SIP env ===
NEXT_PUBLIC_SIP_WSS=wss://app.blinksone.com/sip
NEXT_PUBLIC_SIP_DOMAIN=intelysys.pstn.twilio.com
NEXT_PUBLIC_SIP_USER=blinkone
NEXT_PUBLIC_SIP_PASS=BlinkSip2026!
```

If anything shows `inactive` or `offline`, see Troubleshooting below.

---

## PART C — Browser Test: SIP Registration

1. Open **https://app.blinksone.com/login** — hard refresh (`Ctrl+Shift+R`)
2. Log in as `admin@blinksone.com / Demo@2026!`
3. Open browser **DevTools** → **Console** tab
4. Look for one of these messages within 5–10 seconds:

**✅ Success:**
```
JsSIP: UA registered
```
or
```
[JsSIP] UA registered
```

**❌ Failure patterns to check:**
```
WebSocket connection failed          → Nginx /sip proxy not working
JsSIP: Registration failed: 403      → Wrong SIP username/password
JsSIP: Registration failed: 404      → Wrong SIP domain
JsSIP: UA disconnected               → Kamailio not running
```

> If you see registration success: the calling UI status indicator should change
> from "Softphone offline" to a green/connected state.

---

## PART D — Outbound Call Test

From the BlinkOne Calling module:

1. Click the **dialpad** icon
2. Enter a test number: `+923001234567` (Pakistani number) or your own mobile
3. Click **Call**

**Call path:** Browser WebRTC → wss://app.blinksone.com/sip → Kamailio → intelysys.pstn.twilio.com → PSTN

**What you should hear:** Ringing, then the call connects to the mobile phone.

**What you should see in DevTools Console:**
```
JsSIP: outgoing call INVITE sent
JsSIP: session progress (183)
JsSIP: session confirmed (200)
```

**Check Twilio logs** if call doesn't connect:
- Twilio Console → Monitor → Logs → SIP Trunk Calls
- Look for the INVITE and check the response code

> **Note:** Twilio trial accounts can only call verified numbers.
> Go to Twilio Console → Phone Numbers → Verified Caller IDs to add a number for testing.

---

## PART E — Inbound Call Test (after Part A is done)

1. From any mobile phone, call **(914) 303-8893**
2. Twilio receives the call → looks up Origination URI → sends INVITE to `sip:204.168.137.104:5060`
3. Kamailio receives INVITE → routes to registered browser agent (blinkone@app.blinksone.com)
4. BlinkOne UI shows **incoming call notification** with Answer / Decline buttons

**Inbound call path:** Mobile → Twilio PSTN → SIP INVITE to 204.168.137.104:5060 → Kamailio → Browser WebRTC

---

## PART F — Kamailio Log Monitoring (run while testing)

On the server, watch Kamailio logs in real time while making test calls:

```bash
journalctl -u kamailio -f --no-pager
```

**Healthy log lines when a browser registers:**
```
INFO: <core> [tcp_read.c:...] new connection from ws ...
INFO: registrar [save.c:...] AOR blinkone@app.blinksone.com inserted
```

**Healthy log lines when outbound call goes out:**
```
INFO: <core> INVITE sip:+923001234567@intelysys.pstn.twilio.com
INFO: tm [t_reply.c:...] 200 OK received
```

---

## TROUBLESHOOTING

### ❌ "Softphone offline" — JsSIP never registers

**Step 1:** Check Kamailio is running:
```bash
systemctl status kamailio
```
If not running: `systemctl start kamailio`

**Step 2:** Check Nginx /sip proxy:
```bash
curl -i -H "Connection: Upgrade" -H "Upgrade: websocket" \
     -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
     -H "Sec-WebSocket-Version: 13" \
     http://127.0.0.1:8088/
# Expected: HTTP/1.1 101 Switching Protocols
```

**Step 3:** Check Nginx /sip block in config:
```bash
grep -A8 "location /sip" /etc/nginx/sites-available/blinkone
```
Should show `proxy_pass http://127.0.0.1:8088`

**Step 4:** Rebuild frontend if env vars changed:
```bash
cd /opt/blinkone/frontend && npm run build && pm2 restart blinkone-frontend
```

---

### ❌ Outbound call fails immediately (no ringing)

**Check 1:** Twilio Termination URI is set correctly:
- Console → intelysys trunk → Termination → should show `intelysys.pstn.twilio.com`

**Check 2:** Credential list `blinkone-creds` is attached to the trunk:
- Console → intelysys trunk → Termination → Credential Lists → should show `blinkone-creds`

**Check 3:** Check Twilio trial restrictions:
- Console → Phone Numbers → Verified Caller IDs → add your test number

**Check 4:** Kamailio routing to Twilio:
```bash
journalctl -u kamailio -n 30
# Look for INVITE being sent to intelysys.pstn.twilio.com
```

---

### ❌ Inbound call (914) 303-8893 does not ring browser

**Check 1:** Origination URI is set in Twilio (Part A above)

**Check 2:** Kamailio is listening on port 5060 (UDP):
```bash
ss -ulnp | grep 5060
```

**Check 3:** SIP agent is registered (browser must be open and logged in):
```bash
# Run on server
kamcmd ul.dump
# Should show: blinkone@app.blinksone.com with a Contact address
```

**Check 4:** UFW — if firewall is active, allow SIP:
```bash
ufw status
# If active:
ufw allow 5060/udp comment "SIP UDP"
ufw allow 10000:20000/udp comment "RTP media"
```

---

### ❌ Audio connects but one side cannot hear the other

This is an RTP media issue. RTP packets are blocked by the firewall:

```bash
ufw allow 10000:20000/udp comment "RTP media"
ufw reload
```

Also ensure Kamailio config has `rtpproxy` or `rtpengine` configured for NAT traversal
if agents are behind NAT. For the demo server (public IP) this is typically not needed.

---

## SUMMARY

| Step | What | Where | Status |
|------|------|--------|--------|
| A | Add Origination URI | Twilio Console | ⬜ Do now |
| B | Server health check | SSH | Run after A |
| C | SIP registration check | Browser DevTools | Should show "registered" |
| D | Outbound call test | BlinkOne UI | Dial any number |
| E | Inbound call test | Call (914) 303-8893 | After Part A |

**Demo credentials:**
- URL: https://app.blinksone.com/login
- Email: admin@blinksone.com
- Password: Demo@2026!
- Inbound test number: +1 (914) 303-8893

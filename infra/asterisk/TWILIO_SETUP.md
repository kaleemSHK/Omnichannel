# Twilio SIP Trunk Setup for BlinkOne Demo

## Step 1 — Create Elastic SIP Trunk

1. Go to https://console.twilio.com → Elastic SIP Trunks → Create Trunk
2. Name it: `BlinkOne Demo`
3. **Termination URI**: e.g. `blinkone-demo.pstn.twilio.com`
   (Twilio auto-generates this — copy it to `TWILIO_SIP_HOST` in `.env`)

## Step 2 — Configure Origination (inbound to your server)

In the trunk → Origination tab:

**Option A — Public IP (server/VPS):**

- Add origination URI: `sip:<YOUR_SERVER_PUBLIC_IP>:5060`
- Priority: 1, Weight: 1

**Option B — Laptop + ngrok (no public IP, Android demo):**

- Run `.\infra\ngrok\start-demo.ps1` from repo root
- Add origination URI: `sip:<NGROK_SIP_HOST>:<NGROK_SIP_PORT>` (from **sip-signal** tunnel)
- Example: `sip:0.tcp.ngrok.io:12345`
- See [../ngrok/README.md](../ngrok/README.md)

This tells Twilio where to send inbound calls (your Kamailio :5060).

## Step 3 — Buy a Phone Number

1. Phone Numbers → Manage → Buy a Number
2. Choose any country/area code you want for the demo
3. Copy the number (E.164) to `TWILIO_DID` in `.env`

## Step 4 — Assign number to trunk

Phone Numbers → Manage → Active Numbers → click your number
→ Voice Configuration → SIP Trunk → select `BlinkOne Demo`
→ Save

## Step 5 — Fill in .env

```env
TWILIO_SIP_HOST=blinkone-demo.pstn.twilio.com
TWILIO_DID=+12125551234
TELEPHONY_EXTERNAL_IP=203.0.113.10
TELEPHONY_SIP_DOMAIN=blinkone.local
AST_AGENT_SIP_PASS=blinkone-agent-demo
AST_TRUNK_SIP_PASS=blinkone-trunk-demo
```

## Step 6 — Rebuild and start telephony stack

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.blinkone.yml \
  -f docker-compose.telephony.yml \
  --profile telephony \
  up -d --build blinkone-asterisk blinkone-kamailio blinkone-rtpengine
```

## Step 7 — Verify Asterisk loaded the Twilio trunk

```bash
docker exec -it blinkone-asterisk asterisk -rx "pjsip show endpoints"
# Should show: twilio-trunk
```

```bash
docker exec -it blinkone-asterisk asterisk -rx "pjsip show aors"
# Expected: twilio-trunk-aor with contact sip:<TWILIO_SIP_HOST>
```

## Step 8 — Test inbound call

1. Open BlinkOne agent UI in browser
2. Ensure JsSIP registers (agent status shows Available)
3. Dial the Twilio number from your mobile phone
4. BlinkOne should ring in the browser

## Step 9 — Test outbound call

From the BlinkOne dial pad:

- Enter a phone number in E.164 format: `+96812345678`
- Click Call
- Twilio routes it via PSTN

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Inbound call not ringing | Twilio IPs not whitelisted in Kamailio | Check Kamailio logs; verify IP ranges in `kamailio.cfg.tpl` |
| `twilio-trunk` shows Unavail | Wrong TWILIO_SIP_HOST | Check env var + rebuild Asterisk |
| JsSIP not registering | Wrong NEXT_PUBLIC_SIP_WSS or cert issue | Check nginx WSS proxy at `/telephony/wss` |
| No audio | RTPEngine ports 30000-30100 not open | Open UDP ports on firewall |
| 407 from Twilio | Twilio expects IP auth, not digest | Check `twilio-identify` stanzas match Twilio's real IPs |

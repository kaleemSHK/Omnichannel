# BlinkOne Twilio demo via ngrok (Android phone, no public IP)

Use this when your laptop has **no public IP**. Your Android phone dials a Twilio number; ngrok exposes SIP and WSS to the internet.

## Architecture

```
Android phone → Twilio PSTN → ngrok TCP (:5060) → Kamailio → Asterisk
Browser agent UI → ngrok HTTPS (:80) → nginx → BlinkOne Next.js
JsSIP → ngrok TCP (:8089) → Asterisk WSS
```

## Quick start

### 1. Install ngrok

```powershell
winget install ngrok.ngrok
ngrok config add-authtoken YOUR_TOKEN
ngrok update
```

**Requirements**

- Agent **3.20+** (`ngrok update` if winget installed an old build).
- **TCP tunnels** (`sip-signal`, `asterisk-wss`) on a free account require adding a card at [ngrok ID verification](https://dashboard.ngrok.com/settings#id-verification) (ngrok states it is not charged; needed for SIP/WSS exposure).

### 2. Create config

```powershell
copy infra\ngrok\ngrok.yml.example infra\ngrok\ngrok.yml
```

Authtoken stays in **global** config only (`ngrok config add-authtoken`). Do **not** put `authtoken:` in `infra/ngrok/ngrok.yml` — a placeholder there overrides the global token and ngrok will exit immediately.

### 3. Start ngrok (before Docker telephony)

```powershell
cd E:\BlinkOne
.\infra\ngrok\start-demo.ps1
```

Note the three tunnel URLs from the output or http://127.0.0.1:4040

### 4. Configure Twilio origination

Twilio Console → Elastic SIP Trunks → your trunk → **Origination**:

- URI: `sip:0.tcp.ngrok.io:PORT` (use **sip-signal** tunnel host and port from step 3)
- Priority 1, Weight 1

### 5. Update `.env`

```env
TWILIO_SIP_HOST=your-trunk.pstn.twilio.com
TWILIO_DID=+1XXXXXXXXXX
NGROK_SIP_HOST=0.tcp.ngrok.io
NGROK_SIP_PORT=12345
NGROK_WEB_DOMAIN=yourname.ngrok-free.app
NGROK_WSS_HOST=0.tcp.ngrok.io
NGROK_WSS_PORT=12346
```

### 6. Update `frontend/.env.local`

```env
NEXT_PUBLIC_SIP_WSS=wss://0.tcp.ngrok.io:NGROK_WSS_PORT
NEXT_PUBLIC_WS_URL=wss://yourname.ngrok-free.app/cable
NEXT_PUBLIC_SIP_USER=agent
NEXT_PUBLIC_SIP_PASS=blinkone-agent-demo
NEXT_PUBLIC_USE_DEMO_DATA=false
```

Restart `npm run dev` after changing `NEXT_PUBLIC_*`.

### 7. Start stack

```powershell
docker compose -f docker-compose.yml -f docker-compose.blinkone.yml -f docker-compose.telephony.yml --profile telephony up -d --build
```

### 8. Demo

1. Open BlinkOne (ngrok HTTPS URL or local `npm run dev` on :3001 with proxies)
2. Log in — agent status **Available** (JsSIP registered)
3. Dial your Twilio number from Android
4. Answer in the browser

## Optional: Android as SIP agent

Install **Linphone** or **Zoiper**, register:

- Server: `wss://0.tcp.ngrok.io:WSS_PORT` or use Asterisk WSS tunnel
- User: `agent`
- Password: same as `AST_AGENT_SIP_PASS` in `.env`

## Troubleshooting

| Issue | Fix |
|-------|-----|
| ngrok TCP port changed | Update Twilio origination + `frontend/.env.local` after every ngrok restart |
| JsSIP registration failed | Check `NEXT_PUBLIC_SIP_WSS` matches **asterisk-wss** tunnel; use `wss://` |
| No ring on inbound | Verify Twilio origination points to **sip-signal** tunnel; check Kamailio logs |
| 403 from Kamailio | Source may be Docker bridge IP — already allowed; check `docker logs blinkone-kamailio` |

See also: [../asterisk/TWILIO_SETUP.md](../asterisk/TWILIO_SETUP.md)

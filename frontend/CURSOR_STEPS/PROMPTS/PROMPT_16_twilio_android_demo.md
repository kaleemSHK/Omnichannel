# CURSOR PROMPT — STEP 16: Twilio SIP Demo (Android Phone, No Public IP)
> Paste this ENTIRE file into Cursor Composer.
> Goal: Your Android phone dials a real Twilio number → call rings live in the
>       BlinkOne browser UI on your laptop. No public IP required — uses ngrok tunnels.
> Read `.cursorrules` before writing anything.
> Do NOT modify `src/lib/api/*.ts` or `src/types/index.ts`.

---

## HOW IT WORKS (no public IP needed)

```
Android phone
  │  dials Twilio number (+1xxx)
  ▼
Twilio PSTN cloud
  │  SIP trunk → needs to reach your laptop
  ▼
ngrok TCP tunnel  ←─────────────────────────────────┐
  │  forwards to localhost:5060                       │
  ▼                                                   │
Kamailio :5060 (Docker)                              │
  │  SIP relay                                        │  ngrok exposes
  ▼                                                   │  these ports
Asterisk :5060 (Docker)                              │
  │  WebRTC/WSS ← JsSIP in browser                   │
  ▼                                                   │
RTPEngine (audio)  ←── ngrok TCP tunnel ─────────────┘
  (ports 30000-30100 via single ngrok TCP tunnel)

Browser agent UI ←── ngrok HTTPS tunnel ←── Next.js :80
JsSIP ←── wss://xxxxx.ngrok-free.app/telephony/wss ←── Asterisk :8089
```

**What ngrok does:**
- Gives Twilio a real address to send SIP to (TCP tunnel → your Kamailio port 5060)
- Gives JsSIP a real HTTPS/WSS URL to connect Asterisk WebRTC
- Gives the client a real URL to see the BlinkOne UI

**Your Android phone role in the demo:**
- **As customer**: Dial the Twilio number → call rings in BlinkOne UI on laptop → you answer it as "agent" in browser
- **As agent (optional)**: Install a SIP softphone app (Linphone / Zoiper) → register to Asterisk over WSS → receive calls on phone

---

## PRE-REQUISITES — Install ngrok (5 minutes)

### 1. Install ngrok on your laptop (Windows)

```powershell
# Option A — winget
winget install ngrok.ngrok

# Option B — download from https://ngrok.com/download
# Unzip and place ngrok.exe in C:\Windows\System32
```

### 2. Sign up at https://ngrok.com (free account)

Get your authtoken from: https://dashboard.ngrok.com/get-started/your-authtoken

```powershell
ngrok config add-authtoken YOUR_AUTH_TOKEN_HERE
```

### 3. Free ngrok plan limits (fine for demo)
- 1 free static domain (HTTPS) — claim yours at dashboard.ngrok.com/domains
- TCP tunnels: free (random port assigned each time — update Twilio after each restart)
- Tip: **upgrade to ngrok Starter ($8/mo)** for a fixed TCP address — worth it for demos

---

## PART A — ngrok config file

Create `infra/ngrok/ngrok.yml` (ngrok config — run all tunnels with one command):

```yaml
# infra/ngrok/ngrok.yml
# Run with: ngrok start --all --config infra/ngrok/ngrok.yml

version: "3"
authtoken: YOUR_NGROK_AUTH_TOKEN   # ← replace with your real token

tunnels:
  # BlinkOne web UI + WSS proxy (HTTPS — get a free static domain from ngrok dashboard)
  blinkone-web:
    proto: http
    addr: 80
    # Optional: use your free static domain
    # domain: yourname.ngrok-free.app

  # SIP signaling — Twilio sends INVITE here (TCP tunnel → Kamailio :5060)
  sip-signal:
    proto: tcp
    addr: 5060

  # Asterisk WSS — JsSIP connects here for WebRTC audio
  asterisk-wss:
    proto: tcp
    addr: 8089
```

---

## PART B — `.env` additions (Twilio + ngrok vars)

Add these lines to the **bottom** of `.env` (and `.env.example`):

```env
# ─── Twilio SIP Trunk (Prompt 16 — demo) ─────────────────────────────────────
# From Twilio Console → Elastic SIP Trunks → your trunk → Termination URI
TWILIO_SIP_HOST=demo.pstn.twilio.com
# Your Twilio phone number in E.164 format
TWILIO_DID=+12125551234

# ─── ngrok tunnel addresses (update after each ngrok restart) ─────────────────
# From ngrok dashboard or terminal output after running: ngrok start --all
# Format: 0.tcp.ngrok.io:XXXXX  (the TCP tunnel for SIP port 5060)
NGROK_SIP_HOST=0.tcp.ngrok.io
NGROK_SIP_PORT=12345
# Your ngrok HTTPS domain (static if you claimed one, else xxx.ngrok-free.app)
NGROK_WEB_DOMAIN=yourname.ngrok-free.app
# Asterisk WSS TCP tunnel (format: 0.tcp.ngrok.io:YYYYY)
NGROK_WSS_HOST=0.tcp.ngrok.io
NGROK_WSS_PORT=12346

# ─── Telephony internal (Docker network — keep defaults) ──────────────────────
# For NAT behind laptop: use 127.0.0.1 (ngrok handles external exposure)
TELEPHONY_EXTERNAL_IP=127.0.0.1
TELEPHONY_LOCAL_NET=172.16.0.0/12
TELEPHONY_SIP_DOMAIN=blinkone.local
AST_ARI_USER=blinkone
AST_ARI_PASS=blinkone-ari-secret
AST_AGENT_SIP_PASS=blinkone-agent-demo
AST_TRUNK_SIP_PASS=blinkone-trunk-demo
```

---

## PART C — `infra/asterisk/tenants.yaml`

Create this file (full content):

```yaml
# infra/asterisk/tenants.yaml
tenants:
  default:
    tenant_id: default
    chatwoot_account_id: 1
    trunks:
      - name: twilio-pstn
        host: ${TWILIO_SIP_HOST}
        port: 5060
        transport: udp
        username: blinkone-demo
    dids:
      - "${TWILIO_DID}"
    outbound:
      default_trunk: twilio-pstn
      caller_id: "${TWILIO_DID}"
    recording:
      prefix: "recordings/default"
```

---

## PART D — `infra/asterisk/config/pjsip.conf.tpl` — append Twilio trunk

**APPEND** these stanzas at the very end of the existing file (after `[agent-webrtc-aor]`):

```ini
; ── Twilio SIP Trunk (IP auth — no REGISTER) ─────────────────────────────────
[twilio-trunk]
type=endpoint
context=from-trunk
disallow=all
allow=ulaw,alaw
direct_media=no
rtp_symmetric=yes
force_rport=yes
rewrite_contact=yes
transport=transport-udp
aors=twilio-trunk-aor
from_domain=${TWILIO_SIP_HOST}

[twilio-trunk-aor]
type=aor
contact=sip:${TWILIO_SIP_HOST}
qualify_frequency=0

[twilio-identify]
type=identify
endpoint=twilio-trunk
; Twilio SIP IP ranges (full list: twilio.com/docs/sip-trunking/ip-addresses)
match=54.172.60.0/23
match=54.244.51.0/24
match=54.171.127.192/26
match=35.156.191.128/25
match=54.65.63.192/26
match=54.169.127.128/26
match=54.252.254.64/26
match=177.71.206.192/26
; Allow all for local/ngrok testing (Twilio relays via its own IPs)
match=0.0.0.0/0
```

> **Note on `match=0.0.0.0/0`**: This allows any IP to be identified as the Twilio
> trunk. This is fine for a locked demo environment. For production, remove this and
> use only Twilio's real IP ranges.

---

## PART E — `infra/asterisk/config/extensions.conf` — full rewrite

```ini
; BlinkOne dialplan

[general]
static=yes
writeprotect=no
clearglobalvars=no

[globals]
BLINKONE_IVR_APP=blinkone-ivr

; ── Hand-test extensions ───────────────────────────────────────────────────────
[from-internal]
exten => 1000,1,Answer()
 same => n,Park(default,100)
 same => n,Hangup()

exten => 1001,1,Answer()
 same => n,Echo()
 same => n,Hangup()

exten => 2000,1,Stasis(${BLINKONE_IVR_APP},inbound,2000)
 same => n,Hangup()

; ── PSTN inbound (Twilio → Kamailio → Asterisk) ───────────────────────────────
[from-trunk]
exten => _X.,1,NoOp(Inbound: ${CALLERID(num)} → ${EXTEN})
 same => n,Set(CHANNEL(hangup_handler_push)=blinkone-hangup,s,1)
 same => n,Stasis(${BLINKONE_IVR_APP},inbound,${EXTEN})
 same => n,Hangup()

; ── Agent WebRTC (JsSIP browser → Asterisk WSS) ───────────────────────────────
[from-agent]
exten => _X.,1,NoOp(Agent leg: ${CALLERID(num)} → ${EXTEN})
 same => n,Stasis(${BLINKONE_IVR_APP},agent,${EXTEN})
 same => n,Hangup()

; ── Outbound via Twilio ────────────────────────────────────────────────────────
[from-agent-outbound]
exten => _+.,1,NoOp(Outbound via Twilio: ${EXTEN})
 same => n,Set(CALLERID(num)=${TWILIO_DID})
 same => n,Dial(PJSIP/${EXTEN}@twilio-trunk,60,gH)
 same => n,Hangup()

exten => h,1,NoOp(Outbound hangup: ${DIALSTATUS})

[blinkone-hangup]
exten => s,1,NoOp(Hangup: ${CHANNEL(name)})
 same => n,Return()
```

---

## PART F — `infra/asterisk/scripts/entrypoint.sh` — export new vars

**EDIT** `infra/asterisk/scripts/entrypoint.sh`.
After the existing `export AST_WSS_DOMAIN` line, add:

```sh
export TWILIO_SIP_HOST="${TWILIO_SIP_HOST:-demo.pstn.twilio.com}"
export TWILIO_DID="${TWILIO_DID:-+10000000000}"
```

---

## PART G — `docker-compose.telephony.yml` — pass vars into Asterisk

**EDIT** `docker-compose.telephony.yml`.
In the `blinkone-asterisk` → `environment:` block, append:

```yaml
      TWILIO_SIP_HOST: ${TWILIO_SIP_HOST:-demo.pstn.twilio.com}
      TWILIO_DID: ${TWILIO_DID:-+10000000000}
```

---

## PART H — `frontend/.env.local` — update SIP connection to use ngrok WSS

```env
# BlinkOne frontend — ngrok demo mode (no public IP)
NEXT_PUBLIC_CHATWOOT_URL=/_cw
NEXT_PUBLIC_API_BASE=/_gw

# Use ngrok HTTPS domain for WebSocket (wss:// uses the same ngrok HTTPS tunnel)
NEXT_PUBLIC_WS_URL=wss://YOUR_NGROK_WEB_DOMAIN/cable

# Asterisk WSS via ngrok TCP tunnel → becomes wss://host:port
# Format: wss://0.tcp.ngrok.io:XXXXX  (get port from ngrok dashboard after start)
NEXT_PUBLIC_SIP_WSS=wss://0.tcp.ngrok.io:REPLACE_WITH_NGROK_WSS_PORT
NEXT_PUBLIC_SIP_DOMAIN=blinkone.local
NEXT_PUBLIC_SIP_USER=agent
NEXT_PUBLIC_SIP_PASS=blinkone-agent-demo

NEXT_PUBLIC_USE_DEMO_DATA=false
```

> Replace `YOUR_NGROK_WEB_DOMAIN` and `REPLACE_WITH_NGROK_WSS_PORT` after
> running ngrok (values change each restart unless you have a paid plan).

---

## PART I — `src/lib/hooks/useJsSip.ts` — full rewrite

```ts
'use client';

/**
 * JsSIP WebRTC hook — connects to Asterisk over WSS (via ngrok in demo).
 * No-op in demo mode or when SIP_WSS is not configured.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useCallsStore } from '@/lib/store/calls';
import { useAuthStore } from '@/lib/store/auth';
import { isDemoDataEnabled } from '@/lib/demo/config';

const SIP_WSS    = process.env.NEXT_PUBLIC_SIP_WSS    ?? '';
const SIP_DOMAIN = process.env.NEXT_PUBLIC_SIP_DOMAIN ?? 'blinkone.local';
const SIP_USER   = process.env.NEXT_PUBLIC_SIP_USER   ?? 'agent';
const SIP_PASS   = process.env.NEXT_PUBLIC_SIP_PASS   ?? '';

interface JsSIPUA {
  start(): void;
  stop(): void;
  call(target: string, options: unknown): JsSIPSession;
  on(event: string, handler: (...args: unknown[]) => void): void;
  removeAllListeners(): void;
  isRegistered(): boolean;
}

interface JsSIPSession {
  answer(options?: unknown): void;
  terminate(): void;
  mute(): void;
  unmute(): void;
  hold(): void;
  unhold(): void;
  on(event: string, handler: (...args: unknown[]) => void): void;
}

export function useJsSip() {
  const uaRef      = useRef<JsSIPUA | null>(null);
  const sessionRef = useRef<JsSIPSession | null>(null);
  const { setAgentState, addIncomingCall, removeIncomingCall, setActiveCall } = useCallsStore();
  const { user, tokens } = useAuthStore();

  useEffect(() => {
    if (isDemoDataEnabled()) return;
    if (!SIP_WSS)            return;
    if (!tokens?.gatewayJwt) return;

    let ua: JsSIPUA;

    (async () => {
      try {
        const JsSIP = await import('jssip');
        const sipUser = user?.email?.split('@')[0] ?? SIP_USER;
        const sipUri  = `sip:${sipUser}@${SIP_DOMAIN}`;

        ua = new (JsSIP as unknown as { UA: new (cfg: unknown) => JsSIPUA }).UA({
          sockets: [new (JsSIP as unknown as {
            WebSocketInterface: new (url: string) => unknown
          }).WebSocketInterface(SIP_WSS)],
          uri:              sipUri,
          password:         SIP_PASS,
          display_name:     user?.name ?? sipUser,
          register:         true,
          register_expires: 120,
          session_timers:   false,
        });

        ua.on('registered', () => setAgentState('available'));
        ua.on('unregistered', () => setAgentState('offline'));
        ua.on('registrationFailed', (e: unknown) => {
          console.warn('[JsSIP] registration failed', e);
          setAgentState('offline');
        });

        ua.on('newRTCSession', (data: {
          session:    JsSIPSession;
          originator: string;
          request?:   { from?: { uri?: { user?: string } } };
        }) => {
          const { session, originator } = data;
          sessionRef.current = session;

          if (originator === 'remote') {
            // ── Inbound call (Android phone → Twilio → Asterisk → browser) ──
            const callerNum = data.request?.from?.uri?.user ?? 'unknown';
            const incoming = {
              id:            crypto.randomUUID(),
              tenantId:      user?.tenantId ?? 'default',
              roomId:        crypto.randomUUID(),
              channel:       'voice',
              agentLabel:    user?.name ?? SIP_USER,
              customerPhone: callerNum,
              status:        'ringing' as const,
              transport:     'pstn'    as const,
              direction:     'inbound' as const,
              startedAt:     new Date().toISOString(),
            };
            addIncomingCall(incoming);
            session.on('ended', () => removeIncomingCall(incoming.id));
            session.on('failed', () => removeIncomingCall(incoming.id));
          } else {
            // ── Outbound call (browser → Twilio → PSTN) ──
            setActiveCall({
              id:            crypto.randomUUID(),
              tenantId:      user?.tenantId ?? 'default',
              roomId:        crypto.randomUUID(),
              channel:       'voice',
              agentLabel:    user?.name ?? SIP_USER,
              customerPhone: 'outbound',
              status:        'ringing'  as const,
              transport:     'pstn'     as const,
              direction:     'outbound' as const,
              startedAt:     new Date().toISOString(),
            });
          }

          session.on('confirmed', () => setAgentState('busy'));
          session.on('ended',     () => { sessionRef.current = null; setActiveCall(null); setAgentState('available'); });
          session.on('failed',    () => { sessionRef.current = null; setActiveCall(null); setAgentState('available'); });
        });

        uaRef.current = ua;
        ua.start();
      } catch (err) {
        console.error('[JsSIP] init error', err);
      }
    })();

    return () => { uaRef.current?.stop(); uaRef.current = null; };
  }, [tokens?.gatewayJwt, user?.email]);

  const makeCall = useCallback((destination: string) => {
    if (!uaRef.current?.isRegistered()) return;
    const target = destination.startsWith('sip:')
      ? destination
      : `sip:${destination}@${SIP_DOMAIN}`;
    sessionRef.current = uaRef.current.call(target, {
      mediaConstraints:    { audio: true, video: false },
      rtcOfferConstraints: { offerToReceiveAudio: true, offerToReceiveVideo: false },
      pcConfig: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] },
    });
  }, []);

  const answerCall = useCallback(() => {
    sessionRef.current?.answer({
      mediaConstraints: { audio: true, video: false },
      pcConfig: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] },
    });
  }, []);

  const hangup  = useCallback(() => { sessionRef.current?.terminate(); sessionRef.current = null; }, []);
  const mute    = useCallback(() => sessionRef.current?.mute(),   []);
  const unmute  = useCallback(() => sessionRef.current?.unmute(), []);
  const hold    = useCallback(() => sessionRef.current?.hold(),   []);
  const unhold  = useCallback(() => sessionRef.current?.unhold(), []);

  return { makeCall, answerCall, hangup, mute, unmute, hold, unhold };
}
```

---

## PART J — `src/lib/demo/config.ts` — ensure exports exist

```ts
// src/lib/demo/config.ts
export function isDemoDataEnabled(): boolean {
  return process.env.NEXT_PUBLIC_USE_DEMO_DATA === 'true';
}

export function shouldSkipGatewayFetch(): boolean {
  return isDemoDataEnabled();
}
```

---

## PART K — Create `infra/ngrok/start-demo.ps1` (Windows launcher script)

```powershell
# infra/ngrok/start-demo.ps1
# Run this BEFORE starting the BlinkOne stack.
# It starts all ngrok tunnels and prints the addresses you need for .env.local

Write-Host "Starting ngrok tunnels for BlinkOne demo..." -ForegroundColor Cyan

# Start ngrok with all tunnels defined in ngrok.yml
Start-Process -NoNewWindow ngrok -ArgumentList "start --all --config infra\ngrok\ngrok.yml"

# Wait for ngrok API to be ready
Start-Sleep -Seconds 3

# Query ngrok local API for tunnel addresses
$tunnels = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -Method Get

Write-Host ""
Write-Host "=== NGROK TUNNEL ADDRESSES ===" -ForegroundColor Green
foreach ($t in $tunnels.tunnels) {
    Write-Host "$($t.name): $($t.public_url)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== UPDATE THESE VALUES ===" -ForegroundColor Cyan
Write-Host "1. frontend\.env.local → NEXT_PUBLIC_SIP_WSS = wss://<asterisk-wss tunnel>"
Write-Host "2. frontend\.env.local → NEXT_PUBLIC_WS_URL  = wss://<blinkone-web tunnel>/cable"
Write-Host "3. Twilio Console → Trunk → Origination URI  = sip:<sip-signal tunnel host>:<port>"
Write-Host ""
Write-Host "Then rebuild frontend: cd frontend && npm run build" -ForegroundColor Magenta
```

---

## VERIFICATION AFTER CURSOR APPLIES CHANGES

```bash
# 1. Type check — must be 0 errors
cd frontend && npm run type-check

# 2. Start ngrok (Windows PowerShell)
./infra/ngrok/start-demo.ps1
# Note the 3 tunnel addresses printed

# 3. Update frontend/.env.local with the ngrok addresses
# Then rebuild Next.js so env vars are baked in:
cd frontend && npm run build

# 4. Start the full BlinkOne stack + telephony profile
docker compose \
  -f docker-compose.yml \
  -f docker-compose.blinkone.yml \
  -f docker-compose.telephony.yml \
  --profile telephony \
  up -d --build

# 5. Set Twilio origination URI
# Twilio Console → Elastic SIP Trunks → your trunk → Origination
# Add: sip:<NGROK_SIP_HOST>:<NGROK_SIP_PORT>
# e.g: sip:0.tcp.ngrok.io:12345

# 6. Verify Asterisk loaded the trunk
docker exec blinkone-asterisk asterisk -rx "pjsip show endpoints"
# Should show: twilio-trunk   (Avail or Unknown — Unknown is fine for IP-auth trunks)

# 7. Open BlinkOne UI in browser
# → Agent status shows "Available" (JsSIP registered to Asterisk via ngrok)

# 8. Demo time!
# → Pick up Android phone → dial the Twilio number
# → BlinkOne browser UI rings 🔔
# → Click Answer → live two-way voice call
```

---

## SUMMARY OF ALL CHANGES

| File | Action |
|------|--------|
| `.env` | Add `TWILIO_SIP_HOST`, `TWILIO_DID`, `NGROK_*`, telephony vars |
| `.env.example` | Mirror same vars |
| `infra/ngrok/ngrok.yml` | Create — defines 3 tunnels (web, sip-signal, asterisk-wss) |
| `infra/ngrok/start-demo.ps1` | Create — Windows launcher, prints tunnel addresses |
| `infra/asterisk/tenants.yaml` | Create — Twilio trunk + DID mapping |
| `infra/asterisk/config/pjsip.conf.tpl` | Append `[twilio-trunk]` + `[twilio-identify]` |
| `infra/asterisk/config/extensions.conf` | Full rewrite — adds `[from-agent-outbound]` |
| `infra/asterisk/scripts/entrypoint.sh` | Export `TWILIO_SIP_HOST` + `TWILIO_DID` |
| `docker-compose.telephony.yml` | Pass Twilio vars into Asterisk container |
| `frontend/.env.local` | Update SIP/WSS/WS URLs to ngrok addresses |
| `src/lib/hooks/useJsSip.ts` | Full rewrite — inbound + outbound, proper store updates |
| `src/lib/demo/config.ts` | Ensure `isDemoDataEnabled()` exported |

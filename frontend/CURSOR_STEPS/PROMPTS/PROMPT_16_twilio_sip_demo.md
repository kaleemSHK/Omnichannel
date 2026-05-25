# CURSOR PROMPT — STEP 16: Twilio SIP Trunk Integration (Client Demo)
> Paste this ENTIRE file into Cursor Composer.
> Goal: Wire a real Twilio phone number into BlinkOne so a PSTN caller dials in and rings
>       live in the browser agent UI (JsSIP → Asterisk WSS → Kamailio → Twilio).
> Read `.cursorrules` before writing anything.
> Do NOT modify `src/lib/api/*.ts` or `src/types/index.ts`.

---

## ARCHITECTURE (read-only reference — do not change)

```
Twilio PSTN ──SIP trunk──► Kamailio :5060 ──SIP──► Asterisk :5060
                                                          │
                            Agent browser ◄──WSS:8089────┘
                            (JsSIP in BlinkOne frontend)

Outbound path:
Agent browser ──WSS──► Asterisk ──SIP──► Kamailio ──SIP trunk──► Twilio ──► PSTN
```

**Stack already in repo:**
- `infra/asterisk/` — Asterisk 20, PJSIP + ARI + WebRTC WSS
- `infra/kamailio/` — Kamailio 5.8 SBC between Asterisk and trunks
- `infra/asterisk/tenants.yaml.example` — per-tenant trunk/DID mapping
- `docker-compose.telephony.yml` — telephony profile (Asterisk + Kamailio + RTPEngine)
- `.env` / `.env.example` — central env vars

**Key env vars (already in template, need real Twilio values filled in):**
```
TELEPHONY_EXTERNAL_IP   — your server's public IP
TELEPHONY_SIP_DOMAIN    — SIP domain (e.g. blinkone.local or your domain)
AST_ARI_USER / AST_ARI_PASS
AST_AGENT_SIP_PASS      — password JsSIP uses to register to Asterisk
AST_TRUNK_SIP_PASS      — password Kamailio uses when registering to Asterisk
```

---

## WHAT YOU NEED FROM TWILIO BEFORE RUNNING (collect these first)

From your Twilio Console (https://console.twilio.com):

| Item | Where to find | Example |
|------|---------------|---------|
| Twilio SIP Trunk termination URI | Elastic SIP Trunks → your trunk → Termination | `demo.pstn.twilio.com` |
| Twilio SIP Trunk origination URI | set to `sip:<your-server-ip>:5060` | `sip:203.0.113.10:5060` |
| Twilio phone number | Phone Numbers → Manage → Active | `+12125551234` |
| Account SID | Dashboard | `ACxxxxx` |
| Auth Token | Dashboard | `xxxxx` |
| Twilio SIP IP ranges | docs.twilio.com/en/sip-trunking/ip-addresses | `54.172.60.0/23` etc. |

Twilio Elastic SIP Trunk does NOT support SIP REGISTER — it uses IP authentication.
Kamailio will relay inbound SIP from Twilio's IP ranges to Asterisk.

---

## PART A — `.env` additions (Twilio trunk vars)

Add these lines to the **bottom** of `.env` (and also to `.env.example` in the same place):

```env
# ─── Twilio SIP Trunk (Prompt 16 — demo PSTN) ────────────────────────────────
# Termination URI from Twilio Console → Elastic SIP Trunks → your trunk
TWILIO_SIP_HOST=demo.pstn.twilio.com
# The Twilio phone number assigned to this trunk (E.164 format)
TWILIO_DID=+12125551234
# Your server's public IP — Twilio sends SIP here on port 5060
TELEPHONY_EXTERNAL_IP=203.0.113.10
# LAN CIDR inside Docker (default is fine for local dev)
TELEPHONY_LOCAL_NET=172.16.0.0/12
# SIP domain used for agent registration (blinkone.local is fine for demo)
TELEPHONY_SIP_DOMAIN=blinkone.local
# Asterisk ARI credentials
AST_ARI_USER=blinkone
AST_ARI_PASS=blinkone-ari-secret
# Password JsSIP uses when registering to Asterisk over WSS
AST_AGENT_SIP_PASS=blinkone-agent-demo
# Trunk password Kamailio ↔ Asterisk (internal only — any strong value)
AST_TRUNK_SIP_PASS=blinkone-trunk-demo
```

**Replace the placeholder values** with real ones from your Twilio Console.

---

## PART B — `infra/asterisk/tenants.yaml`

Create this file (copy from `tenants.yaml.example`, replace content entirely):

```yaml
# infra/asterisk/tenants.yaml
# Per-tenant trunk + DID mapping for BlinkOne demo

tenants:
  default:
    tenant_id: default
    chatwoot_account_id: 1
    trunks:
      - name: twilio-pstn
        host: ${TWILIO_SIP_HOST}          # demo.pstn.twilio.com
        port: 5060
        transport: udp
        # Twilio uses IP auth — username/password not used for termination
        # but set them anyway for the PJSIP endpoint config
        username: blinkone-demo
        # password via env: BLINKONE_TRUNK_TWILIO_PSTN_PASS (not used by Twilio)
    dids:
      - "${TWILIO_DID}"                   # +12125551234
    outbound:
      default_trunk: twilio-pstn
      caller_id: "${TWILIO_DID}"
    recording:
      prefix: "recordings/default"
```

Note: `${...}` values are expanded by the entrypoint's envsubst at container start.

---

## PART C — `infra/asterisk/config/pjsip.conf.tpl` — add Twilio trunk stanza

**APPEND** these stanzas at the very end of the existing `pjsip.conf.tpl`
(after the `[agent-webrtc-aor]` section). Do NOT remove any existing content.

```ini
; ── Twilio SIP Trunk (Prompt 16 — IP auth, no REGISTER) ─────────────────────
; Twilio terminates inbound SIP to our public IP. Outbound goes to their host.

[twilio-trunk]
type=endpoint
context=from-trunk
disallow=all
allow=ulaw,alaw
; Twilio only supports G.711 (PCMU=ulaw, PCMA=alaw) on SIP trunks
direct_media=no
rtp_symmetric=yes
force_rport=yes
rewrite_contact=yes
transport=transport-udp
; No auth object — Twilio uses IP-based auth (see twilio-identify below)
aors=twilio-trunk-aor
from_domain=${TWILIO_SIP_HOST}

[twilio-trunk-aor]
type=aor
; Static contact pointing at Twilio's termination host
contact=sip:${TWILIO_SIP_HOST}
qualify_frequency=0

[twilio-identify]
type=identify
endpoint=twilio-trunk
; Twilio SIP signaling IP ranges (US East + US West + EU)
; Full list: https://www.twilio.com/docs/sip-trunking/ip-addresses
match=54.172.60.0/23
match=54.244.51.0/24
match=54.171.127.192/26
match=35.156.191.128/25
match=54.65.63.192/26
match=54.169.127.128/26
match=54.252.254.64/26
match=177.71.206.192/26
; Also allow localhost for local testing / port-forwarding scenarios
match=127.0.0.1/32
```

---

## PART D — `infra/asterisk/config/extensions.conf` — add outbound dial context

**REPLACE** the entire file with this (adds Twilio outbound context while keeping existing):

```ini
; BlinkOne dialplan — logic in ARI (services/ivr); step 1 includes hand-test park ext.

[general]
static=yes
writeprotect=no
clearglobalvars=no

[globals]
BLINKONE_IVR_APP=blinkone-ivr

; ── Step 1 hand-test: internal softphone → park (no ARI required) ─────────────
[from-internal]
exten => 1000,1,NoOp(BlinkOne hand-test: answer and park)
 same => n,Answer()
 same => n,Park(default,100)
 same => n,Hangup()

exten => 1001,1,NoOp(BlinkOne hand-test: echo)
 same => n,Answer()
 same => n,Echo()
 same => n,Hangup()

; IVR ARI test (requires services/ivr with ASTERISK_ARI_ENABLED=1)
exten => 2000,1,NoOp(BlinkOne IVR ARI — welcome + hangup)
 same => n,Stasis(${BLINKONE_IVR_APP},inbound,2000)
 same => n,Hangup()

; ── PSTN inbound (via Kamailio from Twilio) → Stasis IVR app ─────────────────
[from-trunk]
exten => _X.,1,NoOp(Inbound trunk call ${CALLERID(num)} → ${EXTEN})
 same => n,Set(CHANNEL(hangup_handler_push)=blinkone-hangup,s,1)
 same => n,Stasis(${BLINKONE_IVR_APP},inbound,${EXTEN})
 same => n,Hangup()

; ── Agent WebRTC leg → Stasis ─────────────────────────────────────────────────
[from-agent]
exten => _X.,1,NoOp(Agent leg ${CALLERID(num)} → ${EXTEN})
 same => n,Stasis(${BLINKONE_IVR_APP},agent,${EXTEN})
 same => n,Hangup()

; ── Outbound via Twilio SIP trunk ─────────────────────────────────────────────
; ARI dials this context when agent initiates outbound call.
; EXTEN = destination E.164 number e.g. +96812345678
[from-agent-outbound]
exten => _+.,1,NoOp(Outbound via Twilio: ${EXTEN})
 same => n,Set(CALLERID(num)=${TWILIO_DID})
 same => n,Dial(PJSIP/${EXTEN}@twilio-trunk,60,gH)
 same => n,Hangup()

exten => h,1,NoOp(Outbound hangup ${DIALSTATUS})

[blinkone-hangup]
exten => s,1,NoOp(Channel hangup ${CHANNEL(name)})
 same => n,Return()
```

---

## PART E — `infra/asterisk/entrypoint.sh` — export TWILIO_DID + TWILIO_SIP_HOST

The entrypoint already runs `envsubst` on config templates. We need to make sure
`TWILIO_SIP_HOST` and `TWILIO_DID` are exported before the substitution runs.

**EDIT** `infra/asterisk/scripts/entrypoint.sh` — add these two lines right after the
existing `export AST_WSS_DOMAIN` line (around line 22):

```sh
export TWILIO_SIP_HOST="${TWILIO_SIP_HOST:-demo.pstn.twilio.com}"
export TWILIO_DID="${TWILIO_DID:-+10000000000}"
```

The full block should look like:

```sh
export AST_EXTERNAL_IP="${AST_EXTERNAL_IP:-127.0.0.1}"
export AST_LOCAL_NET="${AST_LOCAL_NET:-172.16.0.0/12}"
export AST_ARI_USER="${AST_ARI_USER:-blinkone}"
export AST_ARI_PASS="${AST_ARI_PASS:-blinkone-ari-secret}"
export AST_AGENT_SIP_PASS="${AST_AGENT_SIP_PASS:-blinkone-agent-dev}"
export AST_TRUNK_SIP_PASS="${AST_TRUNK_SIP_PASS:-blinkone-trunk-dev}"
export AST_WSS_DOMAIN="${AST_WSS_DOMAIN:-localhost}"
export TWILIO_SIP_HOST="${TWILIO_SIP_HOST:-demo.pstn.twilio.com}"
export TWILIO_DID="${TWILIO_DID:-+10000000000}"
```

---

## PART F — `docker-compose.telephony.yml` — pass new env vars into containers

**EDIT** `docker-compose.telephony.yml`. In the `blinkone-asterisk` service's
`environment:` block, add these two lines:

```yaml
      TWILIO_SIP_HOST: ${TWILIO_SIP_HOST:-demo.pstn.twilio.com}
      TWILIO_DID: ${TWILIO_DID:-+10000000000}
```

So the full Asterisk environment block becomes:

```yaml
    environment:
      AST_EXTERNAL_IP: ${TELEPHONY_EXTERNAL_IP:-127.0.0.1}
      AST_LOCAL_NET: ${TELEPHONY_LOCAL_NET:-172.16.0.0/12}
      AST_ARI_USER: ${AST_ARI_USER:-blinkone}
      AST_ARI_PASS: ${AST_ARI_PASS:-blinkone-ari-secret}
      AST_AGENT_SIP_PASS: ${AST_AGENT_SIP_PASS:-blinkone-agent-dev}
      AST_TRUNK_SIP_PASS: ${AST_TRUNK_SIP_PASS:-blinkone-trunk-dev}
      AST_WSS_DOMAIN: ${AST_WSS_DOMAIN:-localhost}
      TWILIO_SIP_HOST: ${TWILIO_SIP_HOST:-demo.pstn.twilio.com}
      TWILIO_DID: ${TWILIO_DID:-+10000000000}
```

---

## PART G — `frontend/.env.local` — update SIP settings

**EDIT** `frontend/.env.local` — update the SIP lines to point at your actual server
and use the real SIP domain. Replace the SIP block:

```env
# Same-origin proxies (next.config rewrites → Chatwoot :3000, gateway :80 via nginx)
NEXT_PUBLIC_CHATWOOT_URL=/_cw
NEXT_PUBLIC_API_BASE=/_gw
NEXT_PUBLIC_WS_URL=wss://YOUR_SERVER_IP/cable
NEXT_PUBLIC_SIP_WSS=wss://YOUR_SERVER_IP/telephony/wss
NEXT_PUBLIC_SIP_DOMAIN=blinkone.local
NEXT_PUBLIC_SIP_USER=agent
NEXT_PUBLIC_SIP_PASS=blinkone-agent-demo

# Set to false to use real Chatwoot + gateway
NEXT_PUBLIC_USE_DEMO_DATA=false
```

Replace `YOUR_SERVER_IP` with your actual server's IP or hostname.
`NEXT_PUBLIC_SIP_PASS` must match `AST_AGENT_SIP_PASS` in `.env`.

---

## PART H — `src/lib/hooks/useJsSip.ts` — read SIP_USER + SIP_PASS from env

The hook currently reads `NEXT_PUBLIC_SIP_WSS` and `NEXT_PUBLIC_SIP_DOMAIN`.
It also needs `NEXT_PUBLIC_SIP_USER` and `NEXT_PUBLIC_SIP_PASS` so each agent
registers with the correct extension/password.

**FULL REWRITE** `src/lib/hooks/useJsSip.ts`:

```ts
'use client';

/**
 * JsSIP WebRTC hook — connects to Asterisk over WSS.
 * Reads SIP config from env vars (baked in at build time).
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
    // No-op conditions
    if (isDemoDataEnabled())  return;
    if (!SIP_WSS)             return;
    if (!tokens?.gatewayJwt)  return;

    let ua: JsSIPUA;

    (async () => {
      try {
        const JsSIP = await import('jssip');

        // Derive SIP URI from logged-in user's label or fallback to env SIP_USER
        const sipUser = user?.email?.split('@')[0] ?? SIP_USER;
        const sipUri  = `sip:${sipUser}@${SIP_DOMAIN}`;

        ua = new (JsSIP as unknown as { UA: new (cfg: unknown) => JsSIPUA }).UA({
          sockets:      [new (JsSIP as unknown as { WebSocketInterface: new (url: string) => unknown }).WebSocketInterface(SIP_WSS)],
          uri:          sipUri,
          password:     SIP_PASS,
          display_name: user?.name ?? sipUser,
          register:     true,
          register_expires: 120,
          session_timers: false,
        });

        ua.on('registered', () => {
          setAgentState('available');
        });

        ua.on('unregistered', () => {
          setAgentState('offline');
        });

        ua.on('registrationFailed', (e: unknown) => {
          console.warn('[JsSIP] registration failed', e);
          setAgentState('offline');
        });

        ua.on('newRTCSession', (data: { session: JsSIPSession; request?: { from?: { uri?: { user?: string } } }; originator?: string }) => {
          const { session, originator } = data;
          sessionRef.current = session;

          if (originator === 'remote') {
            // Inbound call — add to incoming queue
            const callerNum = data.request?.from?.uri?.user ?? 'unknown';
            const fakeSession = {
              id:            crypto.randomUUID(),
              tenantId:      user?.tenantId ?? 'default',
              roomId:        crypto.randomUUID(),
              channel:       'voice',
              agentLabel:    user?.name ?? SIP_USER,
              customerPhone: callerNum,
              status:        'ringing' as const,
              transport:     'pstn' as const,
              direction:     'inbound' as const,
              startedAt:     new Date().toISOString(),
            };
            addIncomingCall(fakeSession);

            session.on('ended', () => removeIncomingCall(fakeSession.id));
            session.on('failed', () => removeIncomingCall(fakeSession.id));
          } else {
            // Outbound call
            setActiveCall({
              id:            crypto.randomUUID(),
              tenantId:      user?.tenantId ?? 'default',
              roomId:        crypto.randomUUID(),
              channel:       'voice',
              agentLabel:    user?.name ?? SIP_USER,
              customerPhone: 'outbound',
              status:        'ringing' as const,
              transport:     'pstn' as const,
              direction:     'outbound' as const,
              startedAt:     new Date().toISOString(),
            });
          }

          session.on('confirmed', () => {
            setAgentState('busy');
          });

          session.on('ended', () => {
            sessionRef.current = null;
            setActiveCall(null);
            setAgentState('available');
          });

          session.on('failed', () => {
            sessionRef.current = null;
            setActiveCall(null);
            setAgentState('available');
          });
        });

        uaRef.current = ua;
        ua.start();
      } catch (err) {
        console.error('[JsSIP] init error', err);
      }
    })();

    return () => {
      uaRef.current?.stop();
      uaRef.current = null;
    };
  }, [tokens?.gatewayJwt, user?.email]);

  // ── Public API ───────────────────────────────────────────────────────────────

  const makeCall = useCallback((destination: string) => {
    if (!uaRef.current || !uaRef.current.isRegistered()) {
      console.warn('[JsSIP] not registered — cannot make call');
      return;
    }
    const target = destination.startsWith('sip:')
      ? destination
      : `sip:${destination}@${SIP_DOMAIN}`;

    sessionRef.current = uaRef.current.call(target, {
      mediaConstraints: { audio: true, video: false },
      rtcOfferConstraints: { offerToReceiveAudio: true, offerToReceiveVideo: false },
      pcConfig: {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      },
    });
  }, []);

  const answerCall = useCallback(() => {
    sessionRef.current?.answer({
      mediaConstraints: { audio: true, video: false },
      pcConfig: {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      },
    });
  }, []);

  const hangup = useCallback(() => {
    sessionRef.current?.terminate();
    sessionRef.current = null;
  }, []);

  const mute   = useCallback(() => sessionRef.current?.mute(),   []);
  const unmute = useCallback(() => sessionRef.current?.unmute(), []);
  const hold   = useCallback(() => sessionRef.current?.hold(),   []);
  const unhold = useCallback(() => sessionRef.current?.unhold(), []);

  return { makeCall, answerCall, hangup, mute, unmute, hold, unhold };
}
```

---

## PART I — `src/lib/demo/config.ts` — expose isDemoDataEnabled + shouldSkipGatewayFetch

Ensure these two exports exist (create or update the file — do NOT change if already correct):

```ts
// src/lib/demo/config.ts
export function isDemoDataEnabled(): boolean {
  return process.env.NEXT_PUBLIC_USE_DEMO_DATA === 'true';
}

export function shouldSkipGatewayFetch(): boolean {
  // Skip real gateway calls when in demo mode OR no gateway JWT present
  return isDemoDataEnabled();
}
```

---

## PART J — Kamailio ACL — whitelist Twilio IP ranges

**EDIT** `infra/kamailio/` — find the file that contains the ACL or IP whitelist
(likely `dispatcher.conf`, `acl.conf`, or the main `kamailio.cfg`).

Add Twilio's SIP signaling IP ranges to the trusted/whitelist set so Kamailio
forwards inbound SIP from Twilio to Asterisk without rejecting it as unknown source:

```
# Twilio SIP IP ranges (from https://www.twilio.com/docs/sip-trunking/ip-addresses)
54.172.60.0/23
54.244.51.0/24
54.171.127.192/26
35.156.191.128/25
54.65.63.192/26
54.169.127.128/26
54.252.254.64/26
177.71.206.192/26
```

The exact syntax depends on which Kamailio module handles this. Common patterns:

**If using `permissions` module (allow files):**
```
# /etc/kamailio/address.conf or trusted.conf
54.172.60.0/23
54.244.51.0/24
54.171.127.192/26
35.156.191.128/25
54.65.63.192/26
54.169.127.128/26
54.252.254.64/26
177.71.206.192/26
```

**If using `ipops` / `htable` in `kamailio.cfg`:**
```
modparam("permissions", "address_file", "/etc/kamailio/address.conf")
```

Read the existing Kamailio config and apply the correct syntax for whichever pattern
is already in use.

---

## PART K — Twilio Console setup steps (documentation comment — write as README)

Create `infra/asterisk/TWILIO_SETUP.md`:

```markdown
# Twilio SIP Trunk Setup for BlinkOne Demo

## Step 1 — Create Elastic SIP Trunk

1. Go to https://console.twilio.com → Elastic SIP Trunks → Create Trunk
2. Name it: `BlinkOne Demo`
3. **Termination URI**: `blinkone-demo.pstn.twilio.com`
   (Twilio auto-generates this — copy it to `TWILIO_SIP_HOST` in `.env`)

## Step 2 — Configure Origination (inbound to your server)

In the trunk → Origination tab:
- Add origination URI: `sip:<YOUR_SERVER_PUBLIC_IP>:5060`
- Priority: 1, Weight: 1

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
TWILIO_SIP_HOST=blinkone-demo.pstn.twilio.com   # from Step 1
TWILIO_DID=+12125551234                          # from Step 3
TELEPHONY_EXTERNAL_IP=203.0.113.10               # your server public IP
AST_AGENT_SIP_PASS=blinkone-agent-demo
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
# Should show: twilio-trunk   Avail
```

## Step 8 — Test inbound call

1. Open BlinkOne agent UI in browser
2. Ensure JsSIP registers (agent status shows Available)
3. Dial the Twilio number from your mobile phone
4. → BlinkOne rings in the browser 🎉

## Step 9 — Test outbound call

From the BlinkOne dial pad:
- Enter a phone number in E.164 format: `+96812345678`
- Click Call
- Twilio routes it via PSTN

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Inbound call not ringing | Twilio IPs not whitelisted in Kamailio | Add IP ranges to Kamailio ACL (PART J) |
| `twilio-trunk` shows Unavail | Wrong TWILIO_SIP_HOST | Check env var + rebuild Asterisk |
| JsSIP not registering | Wrong NEXT_PUBLIC_SIP_WSS or cert issue | Check nginx WSS proxy config |
| No audio | RTPEngine port 30000-30100 not open | Open UDP ports on firewall |
| 407 from Twilio | Twilio expects IP auth, not digest | Check `twilio-identify` stanzas match Twilio's real IPs |
```

---

## SUMMARY OF ALL CHANGES

| File | Action |
|------|--------|
| `.env` | Add Twilio + telephony env vars |
| `.env.example` | Mirror same vars |
| `infra/asterisk/tenants.yaml` | Create — Twilio trunk + DID mapping |
| `infra/asterisk/config/pjsip.conf.tpl` | Append `[twilio-trunk]` + `[twilio-identify]` stanzas |
| `infra/asterisk/config/extensions.conf` | Add `[from-agent-outbound]` context for Twilio dial |
| `infra/asterisk/scripts/entrypoint.sh` | Export `TWILIO_SIP_HOST` + `TWILIO_DID` |
| `docker-compose.telephony.yml` | Pass `TWILIO_SIP_HOST` + `TWILIO_DID` into Asterisk |
| `frontend/.env.local` | Update SIP_WSS, SIP_DOMAIN, SIP_USER, SIP_PASS |
| `src/lib/hooks/useJsSip.ts` | Full rewrite — reads SIP_USER/SIP_PASS, proper inbound/outbound handling |
| `src/lib/demo/config.ts` | Ensure `isDemoDataEnabled()` + `shouldSkipGatewayFetch()` exported |
| `infra/kamailio/` (acl/cfg) | Add Twilio IP ranges to trusted sender list |
| `infra/asterisk/TWILIO_SETUP.md` | Create — step-by-step Twilio Console instructions |

## VERIFICATION

After Cursor applies all changes, run:

```bash
# 1. Type check — must be 0 errors
cd frontend && npm run type-check

# 2. Rebuild telephony containers
docker compose \
  -f docker-compose.yml \
  -f docker-compose.blinkone.yml \
  -f docker-compose.telephony.yml \
  --profile telephony \
  up -d --build blinkone-asterisk blinkone-kamailio blinkone-rtpengine

# 3. Check Asterisk sees the Twilio trunk
docker exec blinkone-asterisk asterisk -rx "pjsip show endpoints"
# Expected: twilio-trunk endpoint listed

# 4. Check Twilio trunk AOR has the contact
docker exec blinkone-asterisk asterisk -rx "pjsip show aors"
# Expected: twilio-trunk-aor with contact sip:demo.pstn.twilio.com

# 5. Open BlinkOne UI → check agent status = Available (JsSIP registered)
# 6. Dial the Twilio number → BlinkOne should ring
```

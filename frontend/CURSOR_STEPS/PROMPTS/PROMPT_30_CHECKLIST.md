# PROMPT 30 — Remaining checklist (blinksone.com)

## Already done on server

- Piper TTS container healthy (`ar_JO-kareem-medium` loaded)
- `tts_mode: piper_arabic` (set `PIPER_STUB=0` in `.env`)
- `voice_bot` enabled for tenant `1`
- IVR + AI services running

## 1. Google Cloud STT (live STT)

1. In [Google Cloud Console](https://console.cloud.google.com/):
   - Enable **Cloud Speech-to-Text API**
   - Create service account `blinkone-stt` with role **Cloud Speech Client**
   - Download JSON key

2. From your PC:

```bash
scp C:\path\to\your-key.json root@204.168.137.104:/opt/blinkone/secrets/google-stt.json
```

3. On the server:

```bash
ssh root@204.168.137.104
bash /opt/blinkone/scripts/complete-prompt30-voicebot.sh
```

4. Confirm:

```bash
curl -s -H "Authorization: Bearer $(grep ^AI_TOKEN= /opt/blinkone/.env | cut -d= -f2-)" \
  -H "X-Blinkone-Tenant-Id: 1" \
  http://127.0.0.1:8787/api/ai/v1/voicebot/status | python3 -m json.tool
```

Expect: `"stt_mode": "google_chirp_v2"`.

## 2. Twilio voice webhook

In [Twilio Console](https://console.twilio.com/) → Phone Numbers → **(914) 303-8893**:

| Field | Value |
|--------|--------|
| **A CALL COMES IN** | Webhook |
| URL | `https://app.blinksone.com/api/ivr/v1/ivr/inbound` |
| HTTP | POST |

Smoke test (server):

```bash
bash /opt/blinkone/scripts/test-ivr-inbound.sh
```

Expect HTTP 200 and TwiML with Arabic `<Say>` and `<Record>`.

## 3. Call test

1. Call **(914) 303-8893**
2. Hear Arabic greeting (Polly.Zeina via Twilio)
3. Speak a short Arabic phrase after the beep
4. Bot should reply; after 2–3 misunderstandings it should offer queue transfer

## 4. UI

Open **AI → Knowledge base** → Query tester → **Arabic Voice Bot** card (refresh if needed).

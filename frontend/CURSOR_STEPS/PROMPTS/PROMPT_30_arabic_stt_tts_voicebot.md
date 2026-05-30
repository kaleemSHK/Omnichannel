# PROMPT 30 — Arabic STT + Piper TTS + Voice Bot Activation
## BlinkOne · blinksone.com · TRD Requirements TR-29, TR-35, TR-36, TR-38

---

## CONTEXT

The AI service at `services/ai` already has:
- Google Cloud STT v2 adapter at `services/ai/lib/stt/adapter.js` — currently `GOOGLE_STT_STUB=1`
- Piper TTS integration in the voice bot FSM
- Arabic voice bot FSM at `services/ai/lib/voicebot/fsm.js` — full Arabic intent detection + greeting
- Arabic intent prompt built in: detects plan_change, complaint, billing_inquiry, technical_support, cancellation, general_inquiry

**What's missing**:
1. Real Google Cloud STT credentials are not set (`GOOGLE_STT_STUB=1`)
2. Piper TTS container is not in docker-compose.yml
3. Arabic TTS voice model (ar-OM or ar-SA) is not downloaded
4. IVR service is not wired to the voice bot FSM for inbound calls

---

## PART A — Add Piper TTS to docker-compose.yml

Open `docker-compose.yml` and add the Piper TTS service:

```yaml
  piper-tts:
    image: rhasspy/wyoming-piper:latest
    command: >
      --piper /usr/share/piper/piper
      --data-dir /data
      --download-dir /data
      --voice ar_JO-kareem-medium
    volumes:
      - piper-data:/data
    ports:
      - "127.0.0.1:10200:10200"
    networks:
      - blinkone-net
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "nc", "-z", "localhost", "10200"]
      interval: 30s
      timeout: 10s
      retries: 3
```

Also add to the `volumes:` section at the bottom of docker-compose.yml:
```yaml
  piper-data:
```

> **Note on voice model**: `ar_JO-kareem-medium` is the best available free Arabic voice in Piper. For Omani dialect specifically, `ar-OM` is not yet available in Piper — use `ar_JO-kareem-medium` (Jordanian Arabic, mutually intelligible for business contexts) or `ar_SA-*` if available. Check https://huggingface.co/rhasspy/piper-voices/tree/main for the latest Arabic voices.

---

## PART B — Update AI Service Environment Variables

Open `docker-compose.yml` and update the `ai:` service environment block:

```yaml
  ai:
    build: ./services/ai
    environment:
      PORT: "8793"
      TOKEN: ${GATEWAY_TOKEN}
      # OpenAI / LLM
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      OPENAI_MODEL: ${OPENAI_MODEL:-gpt-4o-mini}
      # Google STT — set GOOGLE_STT_STUB=0 to activate real STT
      GOOGLE_STT_STUB: ${GOOGLE_STT_STUB:-0}
      GOOGLE_APPLICATION_CREDENTIALS: /secrets/google-stt.json
      GOOGLE_STT_PROJECT_ID: ${GOOGLE_STT_PROJECT_ID}
      GOOGLE_STT_LOCATION: ${GOOGLE_STT_LOCATION:-global}
      # Piper TTS
      PIPER_HOST: piper-tts
      PIPER_PORT: "10200"
      PIPER_STUB: ${PIPER_STUB:-0}
      # Voice bot
      VOICEBOT_LANGUAGE: ar-OM
      # Quotas
      DAILY_QUOTA_UNITS: ${AI_DAILY_QUOTA:-10000}
    volumes:
      - ai-data:/data
      - ${GOOGLE_STT_KEY_PATH:-/dev/null}:/secrets/google-stt.json:ro
    depends_on:
      - piper-tts
      - postgres_app
    networks:
      - blinkone-net
    restart: unless-stopped
```

Add to your server `.env` file (`/opt/blinkone/.env`):

```bash
# Google Cloud STT
GOOGLE_STT_STUB=0
GOOGLE_STT_PROJECT_ID=your-gcp-project-id
GOOGLE_STT_LOCATION=global
GOOGLE_STT_KEY_PATH=/opt/blinkone/secrets/google-stt.json

# Piper TTS
PIPER_STUB=0
```

---

## PART C — Create Google Cloud Service Account Key

On your Google Cloud Console:

1. Go to **IAM & Admin** → **Service Accounts**
2. Create a new service account: `blinkone-stt`
3. Grant role: **Cloud Speech Client** (`roles/speech.client`)
4. Create a JSON key → download it
5. Upload to server:

```bash
# On your local machine
scp ~/Downloads/google-stt-key.json root@204.168.137.104:/opt/blinkone/secrets/google-stt.json

# On the server — verify
ssh root@204.168.137.104
cat /opt/blinkone/secrets/google-stt.json | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ Key for project:', d['project_id'])"
```

---

## PART D — Update STT Adapter to Use Chirp v2 (Arabic)

Open `services/ai/lib/stt/adapter.js`. Update the recognition config for Arabic:

```javascript
const recognitionConfig = {
  autoDecodingConfig: {},
  languageCodes: ['ar-OM', 'ar-SA', 'ar-JO', 'ar-EG'], // multi-dialect fallback
  model: 'chirp_2', // Best multilingual model from Google
  features: {
    enableAutomaticPunctuation: true,
    enableWordConfidence: false,
    multiChannelMode: 'SEPARATE_RECOGNITION_PER_CHANNEL',
  },
};
```

If `chirp_2` is unavailable in your GCP region, fall back to `chirp` or `latest_long`.

---

## PART E — Update Piper TTS Integration

Open `services/ai/lib/tts/piper.js` (create if not existing):

```javascript
import net from 'net';

const PIPER_HOST = process.env.PIPER_HOST || 'piper-tts';
const PIPER_PORT = parseInt(process.env.PIPER_PORT || '10200', 10);
const PIPER_STUB = process.env.PIPER_STUB === '1';

/**
 * Synthesise Arabic text to PCM audio via Piper Wyoming protocol.
 * Returns a Buffer of raw 16-bit LE PCM at 22050 Hz.
 */
export async function synthesise(text) {
  if (PIPER_STUB) {
    // Return 200ms of silence for stub mode
    return Buffer.alloc(22050 * 0.2 * 2);
  }

  return new Promise((resolve, reject) => {
    const client = net.createConnection(PIPER_PORT, PIPER_HOST, () => {
      // Wyoming protocol: send JSON header + newline + text + newline
      const header = JSON.stringify({ type: 'synthesize', data: { text } });
      client.write(header + '\n');
      client.write(text + '\n');
    });

    const chunks = [];
    let headerDone = false;

    client.on('data', chunk => {
      if (!headerDone) {
        // Skip Wyoming response header (first newline-terminated JSON)
        const newline = chunk.indexOf('\n');
        if (newline >= 0) {
          headerDone = true;
          chunks.push(chunk.slice(newline + 1));
        }
      } else {
        chunks.push(chunk);
      }
    });

    client.on('end', () => resolve(Buffer.concat(chunks)));
    client.on('error', reject);
    setTimeout(() => {
      client.destroy();
      reject(new Error('Piper TTS timeout'));
    }, 10000);
  });
}
```

---

## PART F — Wire Voice Bot to IVR Service

Open `services/ivr/src/server.js`. Find the inbound call handler and wire the voice bot FSM:

```javascript
import { createSession, processTurn } from '../../ai/lib/voicebot/fsm.js';

// POST /v1/ivr/inbound — called by Twilio on inbound call
app.post('/v1/ivr/inbound', async (req, res) => {
  const { CallSid, From, To } = req.body;
  const tenantId = resolveTenantId(req);

  // Create a new voice bot session
  const session = await createSession({ callId: CallSid, tenantId, callerNumber: From });

  // Respond with greeting TwiML
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="ar-SA" voice="Polly.Zeina">${session.greeting}</Say>
  <Record
    action="/v1/ivr/respond/${CallSid}"
    method="POST"
    maxLength="10"
    playBeep="false"
    trim="trim-silence"
  />
</Response>`;

  res.type('text/xml').send(twiml);
});

// POST /v1/ivr/respond/:callId — called by Twilio with recording URL
app.post('/v1/ivr/respond/:callId', async (req, res) => {
  const { RecordingUrl, CallSid } = req.body;
  const tenantId = resolveTenantId(req);

  let audioBuffer;
  try {
    // Fetch the recording from Twilio
    const audioRes = await fetch(RecordingUrl + '.wav');
    audioBuffer = Buffer.from(await audioRes.arrayBuffer());
  } catch {
    audioBuffer = null;
  }

  // Process through voice bot FSM (STT → intent → RAG → TTS response)
  const turn = await processTurn({ callId: CallSid, tenantId, audioBuffer });

  let twiml;
  if (turn.escalate) {
    // Transfer to agent queue
    twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="ar-SA" voice="Polly.Zeina">${turn.response}</Say>
  <Dial>
    <Queue>${turn.queue ?? 'default'}</Queue>
  </Dial>
</Response>`;
  } else {
    // Continue conversation
    twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="ar-SA" voice="Polly.Zeina">${turn.response}</Say>
  <Record
    action="/v1/ivr/respond/${CallSid}"
    method="POST"
    maxLength="10"
    playBeep="false"
    trim="trim-silence"
  />
</Response>`;
  }

  res.type('text/xml').send(twiml);
});
```

> **Note**: If Piper TTS is producing PCM audio, convert to a format Twilio can play (μ-law 8kHz WAV). Use `ffmpeg` or the `sox` npm package. Alternatively, use Twilio's built-in `Polly.Zeina` (Arabic) TTS voice via `<Say language="ar-SA">` which requires no extra infrastructure — this is recommended for the demo.

---

## PART G — Frontend: Voice Bot Status Indicator

Open `frontend/src/app/(dashboard)/ai/page.tsx`. Add a voice bot status section:

```tsx
// Add to AIKnowledgeWorkspace or a new VoiceBotStatus component
import { useQuery } from '@tanstack/react-query';
import { bnFetch } from '@/lib/api/gateway';

function VoiceBotStatus() {
  const { data } = useQuery({
    queryKey: ['voicebot-status'],
    queryFn: async () => {
      const res = await bnFetch('/ai/v1/voicebot/status');
      return res.ok ? res.json() : null;
    },
    refetchInterval: 30000,
  });

  const isLive = data?.data?.active_sessions > 0;

  return (
    <div className="border rounded-lg p-4 bg-muted/20">
      <div className="flex items-center gap-2 mb-2">
        <span className={`size-2 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
        <h3 className="text-sm font-medium">Arabic Voice Bot</h3>
      </div>
      <div className="text-xs text-muted-foreground space-y-1">
        <p>Language: Arabic (ar-OM / ar-SA)</p>
        <p>STT: {data?.data?.stt_mode ?? 'stub'}</p>
        <p>TTS: {data?.data?.tts_mode ?? 'stub'}</p>
        <p>Active sessions: {data?.data?.active_sessions ?? 0}</p>
      </div>
    </div>
  );
}
```

Add a `/v1/voicebot/status` endpoint to `services/ai/src/server.js`:

```javascript
app.get('/v1/voicebot/status', auth, async (req, res) => {
  return ok(res, {
    stt_mode: process.env.GOOGLE_STT_STUB === '1' ? 'stub' : 'google_chirp_v2',
    tts_mode: process.env.PIPER_STUB === '1' ? 'stub' : 'piper_arabic',
    language: process.env.VOICEBOT_LANGUAGE ?? 'ar-OM',
    active_sessions: 0, // TODO: track from session store
  });
});
```

---

## PART H — Restart and Verify

```bash
ssh root@204.168.137.104
cd /opt/blinkone

# Pull latest changes
git pull origin main

# Start Piper TTS
docker compose up -d piper-tts

# Wait for Piper to download the Arabic voice model (~200MB first run)
docker compose logs -f piper-tts
# Look for: "Loaded voice: ar_JO-kareem-medium"

# Restart AI service with new env vars
docker compose restart ai

# Test STT
docker compose exec ai node -e "
import('./lib/stt/adapter.js').then(m => {
  m.transcribeAudio(Buffer.alloc(1000), 'ar-OM').then(r => console.log('STT result:', r));
});
"

# Test Piper TTS
nc -z localhost 10200 && echo "✅ Piper TTS reachable on :10200" || echo "❌ Not reachable"
```

---

## VERIFICATION CHECKLIST

- [ ] `docker compose ps piper-tts` shows `healthy`
- [ ] `docker compose logs piper-tts` shows Arabic voice model loaded
- [ ] `docker compose exec ai env | grep GOOGLE_STT_STUB` shows `0`
- [ ] AI service `/v1/voicebot/status` returns `stt_mode: "google_chirp_v2"` and `tts_mode: "piper_arabic"`
- [ ] Calling (914) 303-8893 plays Arabic greeting via IVR
- [ ] STT transcribes spoken Arabic correctly (test by speaking a simple phrase)
- [ ] Voice bot escalates to agent queue after 2-3 turns

---

## TRD REQUIREMENTS COVERED

| TRD ID | Requirement | Status After Prompt |
|--------|-------------|---------------------|
| TR-29  | Arabic IVR voice bot with NLU | ✅ DONE |
| TR-35  | Arabic STT (Google Cloud Chirp v2) | ✅ DONE |
| TR-36  | Arabic TTS (Piper + Polly.Zeina fallback) | ✅ DONE |
| TR-38  | IVR self-service with agent escalation | ✅ DONE |

# Prompt 7 — AI sidecar (implemented)

Provider decisions (confirmed):

| Area | Choice |
|------|--------|
| LLM | OpenAI `gpt-4o` / `gpt-4o-mini` |
| STT | Google Cloud Speech v2 (`ar-OM`, stub in dev) |
| TTS | Piper (`ar_JO-kareem-medium`) |
| Vector | pgvector on `postgres_app` |
| Keys | Platform `.env` + per-tenant `ai_provider_configs` |

## Service layout

- `services/ai/openapi.yaml` — API contract
- `services/ai/db/001_ai.sql`, `002_pgvector.sql` — migrations at boot
- `services/ai/lib/` — LLM gateway, PII, RAG, STT worker, Piper TTS, voice FSM, assist
- `services/ai/src/server.js` — Express routes

## Endpoints (via gateway `/api/ai/...`)

- `POST /v1/chat/completions`
- `POST /v1/stt/jobs`, `GET /v1/stt/jobs/:id`
- `POST /v1/tts`
- `GET|POST /v1/rag/collections`, `POST /v1/rag/index`, `POST /v1/rag/query`
- `POST /v1/classify/ticket`, `/v1/sentiment`, `/v1/summarize/conversation`, `/v1/suggest/reply`
- `POST /v1/voice/sessions`, `POST /v1/voice/sessions/:id/turn`
- `POST /v1/events` — Chatwoot fan-in (sentiment + delayed classify)

## Compose

- `postgres_app` image: `pgvector/pgvector:pg16`
- `ai` service: `BLINKONE_DATABASE_URL`, OpenAI, MinIO, Piper URL
- `blinkone-piper` in `docker-compose.blinkone.yml`

## Chatwoot UI

- Settings → **Knowledge base**: `/app/accounts/:id/settings/blinkone/ai/knowledge-base`
- **Agent assist** panel: `blinkone_components/AgentAssist/AgentAssistPanel.vue` — import into conversation sidebar when patching core Chatwoot layout
- `window.chatwootConfig.blinkone.aiToken` from `AI_TOKEN`

## Dev / smoke

```powershell
cd e:\BlinkOne\services\ai
npm install
npm test
docker compose build ai
docker compose up -d ai postgres_app
```

Stub mode (no keys): `GOOGLE_STT_STUB=1`, empty `OPENAI_API_KEY` → stub LLM/STT.

## Tests

- `services/ai/test/pii.test.js`
- `tests/ai/voice/arabic-scenarios.yaml` — scenario corpus for mocked voice CI

## Remaining (optional hardening)

- Wire `AgentAssistPanel` into Chatwoot `ConversationBox` sidebar
- Google STT v2 production client (`@google-cloud/speech`)
- Chatwoot auto-label on `conversation_created` via chatwoot-client
- STT-on-call-completed subscriber → `call_transcripts`
- Expand arabic-scenarios to 30 scripts per spec

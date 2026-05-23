# Runbook: LLM provider outage

## Symptoms

Agent assist errors; voice bot fallback messages; `ai` service 5xx on `/v1/chat/completions`.

## Steps

1. Check provider status (OpenAI/Google).
2. Set `OPENAI_API_KEY` fallback or enable stub: `GOOGLE_STT_STUB=1` for voice-only degrade.
3. Update tenant AI config to secondary model if configured.
4. Display banner in dashboard: "AI assist temporarily unavailable".
5. Queue failed `ai_usage_events` for replay when restored.

## Post-incident

Review billing usage events for partial failures; no double-charge.

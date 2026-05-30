const AI_URL = (process.env.AI_URL || 'http://ai:8793').replace(/\/$/, '');
const AI_TOKEN = (process.env.AI_TOKEN || process.env.TOKEN || '').trim();

function aiHeaders(tenantId) {
  const h = { 'Content-Type': 'application/json' };
  if (AI_TOKEN) h.Authorization = `Bearer ${AI_TOKEN}`;
  if (tenantId) h['X-Blinkone-Tenant-Id'] = String(tenantId);
  return h;
}

async function parseAiResponse(res) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body?.error?.message || body?.message || `AI ${res.status}`);
    err.status = res.status;
    err.code = body?.error?.code;
    throw err;
  }
  return body.data ?? body;
}

export async function createVoiceSession(tenantId, { callId, inboxId, language }) {
  const res = await fetch(`${AI_URL}/v1/voice/sessions`, {
    method: 'POST',
    headers: aiHeaders(tenantId),
    body: JSON.stringify({
      call_id: callId,
      inbox_id: inboxId || 'twilio-inbound',
      language: language || process.env.VOICEBOT_LANGUAGE || 'ar-OM',
    }),
  });
  return parseAiResponse(res);
}

export async function findVoiceSessionByCallId(tenantId, callId) {
  const res = await fetch(`${AI_URL}/v1/voice/sessions/by-call/${encodeURIComponent(callId)}`, {
    headers: aiHeaders(tenantId),
  });
  if (res.status === 404) return null;
  return parseAiResponse(res);
}

export async function processVoiceTurn(tenantId, sessionId, { recordingUrl, audioMinioKey, speechResult }) {
  const res = await fetch(`${AI_URL}/v1/voice/sessions/${encodeURIComponent(sessionId)}/turn`, {
    method: 'POST',
    headers: aiHeaders(tenantId),
    body: JSON.stringify({
      recording_url: recordingUrl,
      audio_minio_key: audioMinioKey,
      speech_result: speechResult,
    }),
  });
  return parseAiResponse(res);
}

/** Meta WhatsApp Calling webhook handler (stub until WABA approved). */
export function verifyWebhook(req) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    return { ok: true, challenge };
  }
  return { ok: false };
}

export function handleWebhook(body) {
  const entry = body?.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;
  return {
    callId: value?.calls?.[0]?.id,
    event: value?.calls?.[0]?.event,
    from: value?.contacts?.[0]?.wa_id,
  };
}

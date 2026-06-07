import express from 'express';
import { createLogger } from './logger.js';
import { resolveTenantId } from './tenant.js';
import * as voicebot from './voicebot-client.js';
import { notifyInboundCall, notifyCallEnded } from './calls-notify.js';
import { continueGraphIvr, hasGraphSession, tryStartGraphIvr } from './twilio-graph-ivr.js';

const log = createLogger('ivr-twilio');

const sessions = new Map();

const IVR_PUBLIC_URL = (process.env.IVR_PUBLIC_URL || 'https://app.blinksone.com/api/ivr').replace(
  /\/$/,
  '',
);

// Direct-to-agent inbound: when enabled, skip the voicebot and bridge the PSTN
// call straight to the browser softphone via Kamailio (Twilio originates a SIP
// leg to AGENT_SIP_URI). Flag-gated so we can revert to the voicebot instantly.
const DIRECT_AGENT_DIAL = String(process.env.DIRECT_AGENT_DIAL || '').toLowerCase() === 'true';
const AGENT_SIP_URI = process.env.AGENT_SIP_URI || 'sip:blinkone@204.168.137.104:5060';

function xmlEscape(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function respondUrl(callSid) {
  return `${IVR_PUBLIC_URL}/v1/ivr/respond/${encodeURIComponent(callSid)}`;
}

function twimlSay(text) {
  return `<Say language="ar-SA" voice="Polly.Zeina">${xmlEscape(text)}</Say>`;
}

/** Twilio speech gather — more reliable than Record for Arabic */
function twimlGatherSpeech(callSid, promptText) {
  const say = promptText ? twimlSay(promptText) : '';
  return `<Gather input="speech" language="ar-SA" speechTimeout="auto" timeout="8" action="${xmlEscape(respondUrl(callSid))}" method="POST">${say}</Gather>`;
}

function twimlPromptAndGather(callSid, sayText, gatherPrompt) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${twimlSay(sayText)}
  <Pause length="1"/>
  ${twimlGatherSpeech(callSid, gatherPrompt)}
  ${twimlSay('لم أسمعك. مع السلامة.')}
  <Hangup/>
</Response>`;
}

async function resolveSession(tenantId, callSid) {
  const cached = sessions.get(callSid);
  if (cached?.sessionId) return cached;
  const row = await voicebot.findVoiceSessionByCallId(tenantId, callSid);
  if (!row?.session_id) return null;
  const meta = { sessionId: row.session_id, tenantId };
  sessions.set(callSid, meta);
  return meta;
}

export const twilioVoicebotRouter = express.Router();
twilioVoicebotRouter.use(express.urlencoded({ extended: true }));

twilioVoicebotRouter.post('/v1/ivr/inbound', async (req, res) => {
  const { CallSid, From, To } = req.body ?? {};
  if (!CallSid) {
    return res.status(400).type('text/plain').send('Missing CallSid');
  }
  const tenantId = resolveTenantId(req);

  // Direct-to-agent: bridge the PSTN call to the browser softphone (via Kamailio)
  // instead of answering with the voicebot. The inbound SIP INVITE drives the
  // agent's incoming-call UI through JsSIP, so no separate broadcast is needed.
  if (DIRECT_AGENT_DIAL) {
    log.info({ CallSid, From, To, agent: AGENT_SIP_URI }, 'twilio inbound → direct agent dial');
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial answerOnBridge="true" timeout="30" callerId="${xmlEscape(From || To || '')}">
    <Sip>${xmlEscape(AGENT_SIP_URI)}</Sip>
  </Dial>
</Response>`;
    return res.type('text/xml').send(twiml);
  }

  const graphTwiml = await tryStartGraphIvr(tenantId, CallSid, From, To);
  if (graphTwiml) {
    return res.type('text/xml').send(graphTwiml);
  }

  try {
    const session = await voicebot.createVoiceSession(tenantId, {
      callId: CallSid,
      inboxId: To || 'twilio-inbound',
    });
    sessions.set(CallSid, {
      sessionId: session.session_id,
      tenantId,
      greeting: session.greeting_text || 'مرحباً بك في بلينك ون، كيف يمكنني مساعدتك؟',
    });

    void notifyInboundCall(tenantId, { callId: CallSid, from: From, to: To }).catch((e) =>
      log.warn({ err: e.message, CallSid }, 'calls notify failed'),
    );

    const greeting = sessions.get(CallSid).greeting;
    log.info({ CallSid, From }, 'twilio inbound voice session');
    return res
      .type('text/xml')
      .send(
        twimlPromptAndGather(
          CallSid,
          greeting,
          'تفضل بالتحدث الآن، كيف يمكنني مساعدتك؟',
        ),
      );
  } catch (e) {
    log.error({ err: e.message, CallSid }, 'twilio inbound failed');
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${twimlSay('عذراً، الخدمة غير متاحة حالياً. يرجى المحاولة لاحقاً.')}
  <Hangup/>
</Response>`;
    return res.type('text/xml').send(twiml);
  }
});

/** Twilio "Call status changes" webhook — paste in Phone Number → Voice config */
twilioVoicebotRouter.post('/v1/ivr/status', async (req, res) => {
  const { CallSid, CallStatus, From, To, Direction } = req.body ?? {};
  if (!CallSid) {
    return res.status(400).type('text/plain').send('Missing CallSid');
  }
  const tenantId = resolveTenantId(req);
  log.info({ CallSid, CallStatus, From, To, Direction }, 'twilio status callback');
  void notifyCallEnded(tenantId, {
    callId: CallSid,
    status: CallStatus,
    from: From,
    to: To,
  }).catch((e) => log.warn({ err: e.message, CallSid }, 'status → calls end failed'));
  return res.type('text/plain').send('OK');
});

twilioVoicebotRouter.post('/v1/ivr/respond/:callId', async (req, res) => {
  const callSid = req.params.callId || req.body?.CallSid;
  const speechResult = req.body?.SpeechResult || req.body?.UnstableSpeechResult;
  const digits = req.body?.Digits || speechResult?.trim?.()?.charAt(0);
  const recordingUrl = req.body?.RecordingUrl;
  const tenantId = resolveTenantId(req);

  if (hasGraphSession(callSid)) {
    const graphTwiml = await continueGraphIvr(tenantId, callSid, digits);
    if (graphTwiml) return res.type('text/xml').send(graphTwiml);
  }

  const meta = (await resolveSession(tenantId, callSid)) ?? { tenantId };

  if (!meta?.sessionId) {
    log.warn({ callSid }, 'twilio respond: no voice session');
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${twimlSay('انتهت الجلسة. مع السلامة.')}
  <Hangup/>
</Response>`;
    return res.type('text/xml').send(twiml);
  }

  try {
    const turn = await voicebot.processVoiceTurn(meta.tenantId ?? tenantId, meta.sessionId, {
      speechResult,
      recordingUrl,
    });

    const responseText =
      turn.response_text || turn.response || 'هل يمكنني مساعدتك في شيء آخر؟';
    const escalate = turn.escalate || turn.state === 'transferring';
    const queue = turn.transfer_to_queue || turn.queue || 'default';

    log.info({ callSid, escalate, transcript: turn.transcript?.slice?.(0, 80) }, 'twilio turn');

    if (escalate) {
      sessions.delete(callSid);
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${twimlSay(responseText)}
  <Dial>
    <Queue>${xmlEscape(queue)}</Queue>
  </Dial>
</Response>`;
      return res.type('text/xml').send(twiml);
    }

    return res
      .type('text/xml')
      .send(twimlPromptAndGather(callSid, responseText, 'هل لديك سؤال آخر؟'));
  } catch (e) {
    log.error({ err: e.message, callSid }, 'twilio respond failed');
    return res
      .type('text/xml')
      .send(twimlPromptAndGather(callSid, 'لم أفهم ذلك. هل يمكنك إعادة صياغة سؤالك؟', 'تفضل بالتحدث مرة أخرى.'));
  }
});

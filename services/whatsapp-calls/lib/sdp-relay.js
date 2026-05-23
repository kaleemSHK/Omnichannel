/** @type {Map<string, { offer?: object, answer?: object }>} */
const sessions = new Map();

export function storeOffer(callId, sdp) {
  sessions.set(callId, { offer: sdp });
}

export function setAnswer(callId, answer) {
  const s = sessions.get(callId) || {};
  s.answer = answer;
  sessions.set(callId, s);
  return s;
}

export function getSession(callId) {
  return sessions.get(callId);
}

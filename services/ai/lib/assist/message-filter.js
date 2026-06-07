const SYSTEM_NOISE = [
  /^assigned to\b/i,
  /^conversation (was )?(resolved|reopened|marked)/i,
  /^automatically resolved/i,
  /^status changed/i,
  /^labels added/i,
];

export function isSystemOrActivityContent(text) {
  const t = String(text ?? '').trim();
  if (!t || t.length < 2) return true;
  return SYSTEM_NOISE.some((re) => re.test(t));
}

export function isValidRagQuery(text) {
  const t = String(text ?? '').trim();
  if (t.length < 3) return false;
  return !isSystemOrActivityContent(t);
}

/** Any real customer utterance — includes short greetings like "Hi". */
export function isValidCustomerMessage(text) {
  const t = String(text ?? '').trim();
  if (!t) return false;
  return !isSystemOrActivityContent(t);
}

const GREETING_RE =
  /^(hi+|hello+|hey+|hiya|good\s+(morning|afternoon|evening)|salaam|assalam|marhaba|howdy|yo|thanks|thank\s*you|shukran|ok+|okay)[\s!.?،]*$/iu;

export function isGreetingMessage(text) {
  const t = String(text ?? '')
    .trim()
    .toLowerCase()
    .replace(/[!?.،]+$/gu, '');
  if (!t) return false;
  if (GREETING_RE.test(t)) return true;
  return t.length <= 12 && !t.includes('?');
}

export function lastCustomerUtterance(messages) {
  if (!Array.isArray(messages)) return '';
  const user = [...messages]
    .reverse()
    .find((m) => m.role === 'user' && isValidCustomerMessage(m.content));
  return String(user?.content ?? '').trim();
}

export function recentConversationText(messages, limit = 6) {
  if (!Array.isArray(messages) || !messages.length) return '';
  return messages
    .filter((m) => {
      const c = String(m.content ?? '').trim();
      return c && !isSystemOrActivityContent(c);
    })
    .slice(-limit)
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n');
}

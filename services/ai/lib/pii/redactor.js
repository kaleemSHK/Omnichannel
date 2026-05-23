/**
 * PII redaction before external LLM/STT (Prompt 7 — non-negotiable).
 */
const PATTERNS = [
  {
    type: 'phone_om',
    re: /\+968[\s-]*(?:7[1-9]|9)\d{3}[\s-]*\d{4}|\+968[\s-]*(?:7[1-9]|9)\d{7}|\b0(?:7[1-9]|9)\d{7}\b/g,
  },
  { type: 'national_id_om', re: /\b[1-9]\d{7}\b/g },
  { type: 'iban', re: /\bOM[\s-]*\d{2}[\s-]*(?:[A-Z0-9][\s-]*){18,22}\b/gi },
  { type: 'email', re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g },
  { type: 'credit_card', re: /\b(?:\d[ -]*?){13,19}\b/g },
];

export function redact(text, enabled = process.env.PII_REDACT_ENABLED !== '0') {
  if (!enabled || !text) return text;
  let out = String(text);
  for (const { type, re } of PATTERNS) {
    out = out.replace(re, `[REDACTED_${type.toUpperCase()}]`);
  }
  return out;
}

export function redactMessages(messages) {
  return messages.map((m) => ({
    ...m,
    content: redact(m.content),
  }));
}

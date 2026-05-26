/** Normalize dial string to E.164 for PSTN SIP URIs (Twilio requires + prefix). */
export function normalizePstnDial(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('sip:')) return trimmed;

  const digits = trimmed.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  // US/Canada: 10 digits or 1 + 10 digits
  if (/^\d{10}$/.test(digits)) return `+1${digits}`;
  if (/^1\d{10}$/.test(digits)) return `+${digits}`;
  // Pakistan demo: 03xx → +923xx
  if (/^0\d{10}$/.test(digits)) return `+92${digits.slice(1)}`;
  if (/^\d{11,15}$/.test(digits)) return `+${digits}`;
  return `+${digits}`;
}

export function pstnSipTarget(raw: string, sipDomain: string): string {
  if (raw.startsWith('sip:')) return raw;
  const e164 = normalizePstnDial(raw);
  return `sip:${e164}@${sipDomain}`;
}

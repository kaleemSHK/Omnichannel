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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Display phone with country code (+E.164). Names / UUIDs pass through unchanged. */
export function formatDisplayPhone(raw: string | undefined | null): string {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return '';
  if (UUID_RE.test(trimmed)) return trimmed;
  const digits = trimmed.replace(/[^\d+]/g, '');
  if (digits.length < 7) return trimmed;
  if (!/^[\d+\s().-]+$/.test(trimmed)) return trimmed;
  return normalizePstnDial(trimmed);
}

/** Compact day + time for call history rows (e.g. Today / 3:52 PM). */
export function formatCallListWhen(iso: string | undefined | null): { day: string; time: string } {
  if (!iso) return { day: '', time: '' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { day: '', time: '' };

  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  let day: string;
  if (sameDay) day = 'Today';
  else if (isYesterday) day = 'Yday';
  else day = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return { day, time };
}

export function formatCallDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  return `${m}:${String(r).padStart(2, '0')}`;
}

import { searchContacts } from '@/lib/api/contacts';
import { normalizePstnDial } from '@/lib/utils/phone';

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

/** Build search queries for the same PSTN number in different formats. */
export function phoneSearchVariants(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const variants = new Set<string>();
  variants.add(trimmed);
  variants.add(trimmed.replace(/\s/g, ''));

  const e164 = normalizePstnDial(trimmed);
  if (e164) variants.add(e164);

  const digits = digitsOnly(trimmed);
  if (digits) variants.add(digits);
  if (digits.length >= 10) variants.add(digits.slice(-10));

  if (e164.startsWith('+92')) {
    variants.add(`0${e164.slice(3)}`);
    variants.add(e164.slice(1));
  }
  if (digits.startsWith('92') && digits.length > 10) {
    variants.add(`0${digits.slice(2)}`);
  }

  return [...variants].filter(v => v.length >= 3);
}

export function phonesMatch(a: string, b: string): boolean {
  const da = digitsOnly(a);
  const db = digitsOnly(b);
  if (!da || !db) return false;
  if (da === db) return true;
  if (da.length >= 10 && db.length >= 10 && da.slice(-10) === db.slice(-10)) return true;
  return false;
}

function parseContactSearch(res: unknown): Array<{ id: number; phone_number?: string }> {
  const payload = (res as { payload?: unknown }).payload;
  if (!Array.isArray(payload)) return [];
  return payload.filter(
    (row): row is { id: number; phone_number?: string } =>
      row != null && typeof row === 'object' && typeof (row as { id?: unknown }).id === 'number',
  );
}

/** Resolve a Chatwoot contact id from a caller phone number. */
export async function findContactByPhone(
  phone: string | null | undefined,
): Promise<number | null> {
  if (!phone?.trim()) return null;

  for (const query of phoneSearchVariants(phone)) {
    try {
      const res = await searchContacts(query, 1);
      const contacts = parseContactSearch(res);
      if (!contacts.length) continue;

      const exact = contacts.find(c => c.phone_number && phonesMatch(c.phone_number, phone));
      if (exact) return exact.id;
      if (contacts.length === 1) return contacts[0]!.id;
    } catch {
      /* try next variant */
    }
  }

  return null;
}

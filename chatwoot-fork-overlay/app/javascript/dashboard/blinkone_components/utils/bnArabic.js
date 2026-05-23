/** Detect if text is predominantly Arabic (Prompt 8 / UI redesign). */
export function isMostlyArabic(text) {
  if (!text || typeof text !== 'string') return false;
  const ar = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const letters = (text.match(/\p{L}/gu) || []).length || text.length;
  return letters > 0 && ar / letters > 0.6;
}

const PASTELS = [
  ['#E8F4FD', '#1E5A8A'],
  ['#F3E8FF', '#5B21B6'],
  ['#ECFDF3', '#166534'],
  ['#FFF7ED', '#9A3412'],
  ['#FEF3F2', '#991B1B'],
  ['#F0FDF4', '#15803D'],
  ['#EFF6FF', '#1D4ED8'],
  ['#FDF4FF', '#86198F'],
];

export function avatarColors(seed = '') {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h + seed.charCodeAt(i)) % 997;
  return PASTELS[h % PASTELS.length];
}

export function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (isMostlyArabic(name)) {
    return parts
      .slice(0, 2)
      .map(p => p[0])
      .join('');
  }
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

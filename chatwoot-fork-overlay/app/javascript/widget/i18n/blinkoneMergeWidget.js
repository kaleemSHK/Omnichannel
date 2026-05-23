// BLINKONE: Widget locale rebrand
const REPLACEMENTS = [
  [/Powered by Chatwoot/gi, 'Powered by BlinkOne'],
  [/\bChatwoot\b/g, 'BlinkOne'],
];

function autoReplace(value) {
  if (typeof value === 'string') {
    let next = value;
    for (const [pattern, replacement] of REPLACEMENTS) {
      next = next.replace(pattern, replacement);
    }
    return next;
  }
  if (Array.isArray(value)) return value.map(autoReplace);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, autoReplace(v)]));
  }
  return value;
}

export default function mergeBlinkoneWidgetLocales(locales) {
  return Object.fromEntries(
    Object.entries(locales).map(([locale, pack]) => [locale, autoReplace(pack)])
  );
}

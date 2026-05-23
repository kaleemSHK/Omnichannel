// BLINKONE: Deep-merge locale packs and replace visible Chatwoot branding strings.
import enOverrides from './locale/en/blinkone_overrides.json';
import arOverrides from './locale/ar/blinkone_overrides.json';

const EXPLICIT = { en: enOverrides, ar: arOverrides };

const REPLACEMENTS = [
  [/Powered by Chatwoot/gi, 'Powered by BlinkOne'],
  [/\bChatwoot\b/g, 'BlinkOne'],
  [/https:\/\/www\.chatwoot\.com/g, 'https://blinkone.ai'],
  [/https:\/\/chatwoot\.com/g, 'https://blinkone.ai'],
  [/hello@chatwoot\.com/g, 'noreply@blinkone.ai'],
];

function deepMerge(target, source) {
  if (!source || typeof source !== 'object') return target;
  const out = Array.isArray(target) ? [...target] : { ...target };
  for (const [key, value] of Object.entries(source)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof out[key] === 'object' &&
      out[key] !== null &&
      !Array.isArray(out[key])
    ) {
      out[key] = deepMerge(out[key], value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function autoReplaceStrings(value) {
  if (typeof value === 'string') {
    let next = value;
    for (const [pattern, replacement] of REPLACEMENTS) {
      next = next.replace(pattern, replacement);
    }
    return next;
  }
  if (Array.isArray(value)) return value.map(autoReplaceStrings);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, autoReplaceStrings(v)])
    );
  }
  return value;
}

export default function mergeBlinkoneLocales(locales) {
  // BLINKONE: style — base Chatwoot locale first, then overrides on top (overrides win)
  return Object.fromEntries(
    Object.entries(locales).map(([locale, messages]) => {
      const replaced = autoReplaceStrings(messages);
      const overrides = EXPLICIT[locale] || {};
      return [locale, deepMerge(replaced, overrides)];
    })
  );
}

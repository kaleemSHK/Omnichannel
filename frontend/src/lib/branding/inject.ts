/**
 * CSS variable injection for tenant white-label branding.
 *
 * Tailwind uses the RGB-channel pattern `rgb(var(--brand-primary-rgb) / <alpha>)`,
 * so we store channels ("11 95 255") not the full hex.  Full hex is also stored in
 * `--brand-primary` for direct use in non-Tailwind style props.
 *
 * Safe to call on every render — only sets properties that have a value.
 * No-ops on the server (typeof document guard).
 */

export interface BrandVars {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  productName?: string;
  companyName?: string;
  faviconUrl?: string;
  logoUrl?: string | { full?: string; mark?: string };
  fontFamily?: string;
}

/** "#0B5FFF" or "#0BF" → "11 95 255" (space-sep channels for CSS rgb() function). */
function hexToChannels(hex: string): string {
  const clean = hex.replace(/^#/, '');
  const expanded =
    clean.length === 3
      ? clean
          .split('')
          .map(c => c + c)
          .join('')
      : clean;
  const r = parseInt(expanded.slice(0, 2), 16);
  const g = parseInt(expanded.slice(2, 4), 16);
  const b = parseInt(expanded.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return '';
  return `${r} ${g} ${b}`;
}

const HEX_RE = /^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/;

function setColorVar(root: HTMLElement, varName: string, rgbVarName: string, hex: string) {
  if (!HEX_RE.test(hex)) return;
  const channels = hexToChannels(hex);
  if (!channels) return;
  root.style.setProperty(varName, hex);
  root.style.setProperty(rgbVarName, channels);
}

export function injectBrandingVars(brand: BrandVars | null | undefined): void {
  if (!brand || typeof document === 'undefined') return;
  const root = document.documentElement;

  if (brand.primaryColor) {
    setColorVar(root, '--brand-primary', '--brand-primary-rgb', brand.primaryColor);
  }

  const accent = brand.accentColor ?? brand.secondaryColor;
  if (accent) {
    setColorVar(root, '--brand-accent', '--brand-accent-rgb', accent);
  }

  if (brand.fontFamily) {
    root.style.setProperty('--brand-font', brand.fontFamily);
    document.body.style.fontFamily = `'${brand.fontFamily}', var(--font-inter), system-ui, sans-serif`;
  }

  const name = brand.productName ?? brand.companyName;
  if (name) document.title = name;

  if (brand.faviconUrl) injectFavicon(brand.faviconUrl);
}

export function injectFavicon(url: string): void {
  if (typeof document === 'undefined') return;
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = url;
}

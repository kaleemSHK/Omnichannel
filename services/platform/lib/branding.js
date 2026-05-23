import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_CONFIG = join(__dirname, '../../../config/blinkone/branding.yml');

let cached = null;

export function brandingConfigPath() {
  return process.env.BLINKONE_BRANDING_CONFIG || DEFAULT_CONFIG;
}

export function loadBrandingConfig(force = false) {
  if (cached && !force) return cached;
  const path = brandingConfigPath();
  if (!existsSync(path)) throw new Error(`Branding config not found: ${path}`);
  cached = yaml.parse(readFileSync(path, 'utf8'));
  return cached;
}

function deepMerge(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b || {})) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && typeof out[k] === 'object'
      ? deepMerge(out[k], v)
      : v;
  }
  return out;
}

function merged(accountId, runtimeOverrides = {}) {
  const cfg = loadBrandingConfig();
  const base = { ...(cfg.default || {}) };
  const tenantKey = accountId != null ? String(accountId) : null;
  const tenant = tenantKey ? (cfg.tenants?.[tenantKey] || {}) : {};
  const runtime = tenantKey ? (runtimeOverrides[tenantKey] || {}) : {};
  return deepMerge(deepMerge(base, tenant), runtime);
}

function assetUrl(filename, accountId, cfg, tenantAssets = {}) {
  if (!filename) return null;
  const key = String(accountId ?? '');
  const override = tenantAssets[key]?.[filename];
  if (override) return override;
  const base = (cfg.assets_base_url || '/blinkone-brand').replace(/\/$/, '');
  return `${base}/${filename}`;
}

export function effectiveBranding(accountId = null, runtimeOverrides = {}, tenantAssets = {}) {
  const m = merged(accountId, runtimeOverrides);
  const logos = m.logos || {};
  const productName = m.product_name;
  const companyName = m.company_name;

  return {
    productName,
    companyName,
    primaryColor: m.primary_color,
    secondaryColor: m.secondary_color,
    tagline: m.tagline,
    emailFromName: m.email_from_name,
    emailFromAddress: m.email_from_address,
    emailFrom: `${m.email_from_name} <${m.email_from_address}>`,
    supportUrl: m.support_url,
    marketingUrl: m.marketing_url,
    termsUrl: m.terms_url,
    privacyUrl: m.privacy_url,
    copyrightLine: `© ${new Date().getFullYear()} ${companyName}. ${productName} is a product of ${companyName}.`,
    logoUrl: {
      full: assetUrl(logos.full, accountId, m, tenantAssets),
      mark: assetUrl(logos.mark, accountId, m, tenantAssets),
      email: assetUrl(logos.email, accountId, m, tenantAssets),
    },
    faviconUrl: assetUrl(m.favicon, accountId, m, tenantAssets),
    ogImageUrl: assetUrl(m.og_image, accountId, m, tenantAssets),
    splashUrl: assetUrl(m.splash, accountId, m, tenantAssets),
    accountId: accountId != null ? Number(accountId) : null,
  };
}

export const PUBLIC_BRAND_KEYS = new Set([
  'productName', 'companyName', 'primaryColor', 'secondaryColor', 'tagline',
  'supportUrl', 'marketingUrl', 'termsUrl', 'privacyUrl', 'copyrightLine',
  'logoUrl', 'faviconUrl', 'ogImageUrl', 'splashUrl', 'accountId',
]);

export function publicBrandingPayload(accountId, runtimeOverrides, tenantAssets) {
  const full = effectiveBranding(accountId, runtimeOverrides, tenantAssets);
  return Object.fromEntries(Object.entries(full).filter(([k]) => PUBLIC_BRAND_KEYS.has(k)));
}

export const ALLOWED_PATCH_KEYS = new Set([
  'productName', 'companyName', 'primaryColor', 'secondaryColor', 'tagline',
  'emailFromName', 'emailFromAddress', 'supportUrl', 'marketingUrl', 'termsUrl', 'privacyUrl',
]);

export function patchToYamlOverride(body) {
  const map = {
    productName: 'product_name',
    companyName: 'company_name',
    primaryColor: 'primary_color',
    secondaryColor: 'secondary_color',
    tagline: 'tagline',
    emailFromName: 'email_from_name',
    emailFromAddress: 'email_from_address',
    supportUrl: 'support_url',
    marketingUrl: 'marketing_url',
    termsUrl: 'terms_url',
    privacyUrl: 'privacy_url',
  };
  const out = {};
  for (const [k, v] of Object.entries(body || {})) {
    if (!ALLOWED_PATCH_KEYS.has(k) || v == null) continue;
    out[map[k] || k] = v;
  }
  return out;
}

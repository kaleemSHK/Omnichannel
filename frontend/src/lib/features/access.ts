import { defaultFeatures, type PlatformFeatureKey } from '@/lib/utils/platform';

export type TenantFeaturesMap = Record<PlatformFeatureKey, boolean>;

export function normalizeTenantFeatures(raw: Record<string, unknown> | null | undefined): TenantFeaturesMap {
  return defaultFeatures(raw ?? undefined);
}

export function isFeatureOn(features: TenantFeaturesMap, key: PlatformFeatureKey): boolean {
  return features[key] === true;
}

/** Voice / telephony modules — any calling entitlement. */
export function hasCallingEntitlement(features: TenantFeaturesMap): boolean {
  return (
    features.ivr ||
    features.pstn ||
    features.whatsappCalling ||
    features.telephony ||
    features.voiceBot
  );
}

/** AI workspace — assist, RAG, or voice bot. */
export function hasAiEntitlement(features: TenantFeaturesMap): boolean {
  return features.aiAssist || features.rag || features.voiceBot;
}

const ROUTE_FEATURE: Array<{ prefix: string; check: (f: TenantFeaturesMap) => boolean }> = [
  { prefix: '/calling', check: hasCallingEntitlement },
  { prefix: '/sla', check: f => f.sla },
  { prefix: '/escalation', check: f => f.escalation },
  { prefix: '/ai', check: hasAiEntitlement },
  { prefix: '/billing', check: f => f.billing },
];

/** Returns false when route requires a disabled tenant feature. Core routes always pass. */
export function canAccessTenantFeatureRoute(pathname: string, features: TenantFeaturesMap): boolean {
  for (const { prefix, check } of ROUTE_FEATURE) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return check(features);
    }
  }
  return true;
}

const SETTINGS_FEATURES: Record<string, (f: TenantFeaturesMap) => boolean> = {
  queues: hasCallingEntitlement,
  'sla-policies': f => f.sla,
  recording: hasCallingEntitlement,
  acw: hasCallingEntitlement,
  voice: f => f.voiceBot || hasCallingEntitlement(f),
  telephony: f => f.pstn || f.telephony,
  'bot-routing': hasAiEntitlement,
  bots: hasAiEntitlement,
};

export function isSettingsViewEnabled(view: string, features: TenantFeaturesMap): boolean {
  const check = SETTINGS_FEATURES[view];
  return check ? check(features) : true;
}

export function firstAllowedRoute(features: TenantFeaturesMap): string {
  const candidates = ['/conversations', '/contacts', '/tickets', '/settings'];
  for (const href of candidates) {
    if (canAccessTenantFeatureRoute(href, features)) return href;
  }
  return '/conversations';
}

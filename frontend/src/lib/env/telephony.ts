/** Detect unset template values in public env vars. */
export function isPlaceholderEnv(value: string | undefined): boolean {
  if (!value?.trim()) return true;
  return /REPLACE_|yourname|example\.|changeme|<|TODO/i.test(value);
}

export function isValidWebSocketUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'ws:' || u.protocol === 'wss:';
  } catch {
    return false;
  }
}

export function getConfiguredWsUrl(): string {
  const fallback = `${(process.env.NEXT_PUBLIC_CHATWOOT_URL ?? 'http://127.0.0.1:3000').replace(/^http/, 'ws')}/cable`;
  let url = process.env.NEXT_PUBLIC_WS_URL ?? fallback;

  // app.blinksone.com is Cloudflare-proxied — ActionCable must use grey-cloud ws host.
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (
      host === 'app.blinksone.com'
      && /app\.blinksone\.com\/cable/i.test(url)
    ) {
      url = 'wss://ws.blinksone.com/cable';
    }
  }

  return url;
}

export function isActionCableReady(): boolean {
  const url = getConfiguredWsUrl();
  return !isPlaceholderEnv(url) && isValidWebSocketUrl(url);
}

export function isSipReady(): boolean {
  const wss = process.env.NEXT_PUBLIC_SIP_WSS ?? '';
  const pass = process.env.NEXT_PUBLIC_SIP_PASS ?? '';
  if (isPlaceholderEnv(wss) || isPlaceholderEnv(pass)) return false;
  return isValidWebSocketUrl(wss);
}

/** True when WSS points at loopback (routing default must not override production env). */
export function isLocalhostWsUrl(url: string | undefined): boolean {
  if (!url?.trim()) return false;
  try {
    const h = new URL(url.trim()).hostname;
    return h === 'localhost' || h === '127.0.0.1' || h === '::1';
  } catch {
    return false;
  }
}

/** Prefer baked-in NEXT_PUBLIC_SIP_WSS when API returns dev localhost defaults. */
export function resolveSipWsUri(apiWsUri: string | undefined, envWsUri: string): string {
  const env = envWsUri?.trim() ?? '';
  const api = apiWsUri?.trim() ?? '';
  if (!api || isPlaceholderEnv(api)) return env;
  if (isLocalhostWsUrl(api) && env && !isPlaceholderEnv(env) && !isLocalhostWsUrl(env)) return env;
  return api;
}

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
  return (
    process.env.NEXT_PUBLIC_WS_URL ??
    `${(process.env.NEXT_PUBLIC_CHATWOOT_URL ?? 'http://127.0.0.1:3000').replace(/^http/, 'ws')}/cable`
  );
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

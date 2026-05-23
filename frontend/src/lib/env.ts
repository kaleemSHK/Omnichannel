/**
 * Public API bases. Use same-origin proxy paths (/_cw, /_gw) to avoid CORS when
 * the UI is on :80 and Chatwoot/gateway are on other ports.
 * Server-side rewrites target CHATWOOT_UPSTREAM / GATEWAY_UPSTREAM (see next.config).
 */

export const CHATWOOT_URL = (
  process.env.NEXT_PUBLIC_CHATWOOT_URL ?? '/_cw'
).replace(/\/$/, '');

export const GATEWAY_URL = (process.env.NEXT_PUBLIC_API_BASE ?? '/_gw').replace(/\/$/, '');

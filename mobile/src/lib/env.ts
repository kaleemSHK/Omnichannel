import Config from 'react-native-config';

function cfg(key: string, fallback = ''): string {
  const v = Config[key as keyof typeof Config];
  return (typeof v === 'string' && v.length > 0 ? v : fallback).replace(/\/$/, '');
}

export const CHATWOOT_URL = cfg('CHATWOOT_URL', 'http://192.168.1.50:3000');
export const GATEWAY_URL = cfg('GATEWAY_URL', 'http://192.168.1.50:8080');
export const WS_URL = cfg('WS_URL', 'ws://192.168.1.50:3000/cable');
export const SIP_WSS = cfg('SIP_WSS', '');
export const SIP_DOMAIN = cfg('SIP_DOMAIN', 'blinkone.local');
export const SIP_PASS = cfg('SIP_PASS', '');
export const STUN = cfg('STUN', 'stun:stun.l.google.com:19302');
export const TURN_SERVER = cfg('TURN_SERVER', '');
export const TURN_USER = cfg('TURN_USER', '');
export const TURN_PASS = cfg('TURN_PASS', '');
/** After ACD assign, dial browser desk SIP user (Kamailio usrloc). Not numeric ext 5000. */
export const SUPPORT_EXT = cfg('SUPPORT_EXT', 'blinkone');
export const AGENT_DESK_EXT = cfg('AGENT_DESK_EXT', 'blinkone');
export const SUPPORT_QUEUE = cfg('SUPPORT_QUEUE', 'support');
export const DEFAULT_LANG = cfg('DEFAULT_LANG', 'en');

function isLocalhostWs(url: string): boolean {
  try {
    const h = new URL(url).hostname;
    return h === 'localhost' || h === '127.0.0.1';
  } catch {
    return false;
  }
}

/** Prefer production SIP_WSS when routing API returns localhost defaults. */
export function resolveSipWsUri(apiWsUri: string | undefined): string {
  const env = SIP_WSS;
  const api = (apiWsUri ?? '').trim();
  if (!api) return env;
  if (isLocalhostWs(api) && env && !isLocalhostWs(env)) return env;
  return api;
}

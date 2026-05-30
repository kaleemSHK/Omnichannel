import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_SERVICE = 'blinkone_tokens';
const PREFS_KEY = 'blinkone_prefs';
const CUSTOMER_SESSION_KEY = 'blinkone_customer_session';

export interface StoredTokens {
  accessToken: string;
  gatewayJwt: string;
}

export interface StoredPrefs {
  role: 'agent' | 'customer';
  lang: 'ar' | 'en';
  theme: 'dark' | 'light' | 'system';
}

export interface StoredCustomerSession {
  token?: string;
  contactId?: number;
  conversationId?: number;
  accountId?: number;
  name?: string;
}

export async function saveTokens(tokens: StoredTokens): Promise<void> {
  await Keychain.setGenericPassword(TOKEN_SERVICE, JSON.stringify(tokens), {
    service: TOKEN_SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
  });
}

export async function loadTokens(): Promise<StoredTokens | null> {
  try {
    const creds = await Keychain.getGenericPassword({ service: TOKEN_SERVICE });
    if (!creds) return null;
    return JSON.parse(creds.password) as StoredTokens;
  } catch {
    return null;
  }
}

export async function clearTokens(): Promise<void> {
  await Keychain.resetGenericPassword({ service: TOKEN_SERVICE });
}

export async function savePrefs(prefs: Partial<StoredPrefs>): Promise<void> {
  const current = await loadPrefs();
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify({ ...current, ...prefs }));
}

export async function loadPrefs(): Promise<StoredPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    return raw ? (JSON.parse(raw) as StoredPrefs) : { role: 'agent', lang: 'en', theme: 'system' };
  } catch {
    return { role: 'agent', lang: 'en', theme: 'system' };
  }
}

export async function saveCustomerSession(session: StoredCustomerSession): Promise<void> {
  const current = await loadCustomerSession();
  await AsyncStorage.setItem(CUSTOMER_SESSION_KEY, JSON.stringify({ ...current, ...session }));
}

export async function loadCustomerSession(): Promise<StoredCustomerSession> {
  try {
    const raw = await AsyncStorage.getItem(CUSTOMER_SESSION_KEY);
    return raw ? (JSON.parse(raw) as StoredCustomerSession) : {};
  } catch {
    return {};
  }
}

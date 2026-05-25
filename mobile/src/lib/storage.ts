import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'blinkone_tokens';
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
  contactId?: number;
  conversationId?: number;
}

export async function saveTokens(tokens: StoredTokens): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify(tokens));
}

export async function loadTokens(): Promise<StoredTokens | null> {
  try {
    const raw = await SecureStore.getItemAsync(TOKEN_KEY);
    return raw ? (JSON.parse(raw) as StoredTokens) : null;
  } catch {
    return null;
  }
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
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

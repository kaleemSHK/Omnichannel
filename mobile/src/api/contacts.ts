import { cwFetch } from './client';
import type { CWContact, ApiResponse } from '@/types';
import { useAuthStore } from '@/store/auth';
import { extractContactsMeta, parseContactsList } from '@/lib/utils/contacts';

function accountId() {
  return useAuthStore.getState().user?.chatwootAccountId ?? 0;
}

async function fetchContactsList(path: string): Promise<ApiResponse<CWContact[]>> {
  const raw = await cwFetch<unknown>(path);
  return {
    data: parseContactsList(raw),
    meta: extractContactsMeta(raw),
  };
}

export async function searchContacts(query: string, page = 1): Promise<ApiResponse<CWContact[]>> {
  const params = new URLSearchParams({ q: query, page: String(page) });
  return fetchContactsList(`/accounts/${accountId()}/contacts/search?${params}`);
}

export async function listContacts(page = 1): Promise<ApiResponse<CWContact[]>> {
  return fetchContactsList(`/accounts/${accountId()}/contacts?page=${page}`);
}

export async function getContact(id: number): Promise<CWContact> {
  const raw = await cwFetch<unknown>(`/accounts/${accountId()}/contacts/${id}`);
  if (raw && typeof raw === 'object' && 'payload' in raw) {
    return (raw as { payload: CWContact }).payload;
  }
  return raw as CWContact;
}

export async function createContact(data: {
  name: string;
  email?: string;
  phone_number?: string;
}): Promise<CWContact> {
  return cwFetch<CWContact>(`/accounts/${accountId()}/contacts`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

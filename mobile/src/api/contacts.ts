import { cwFetch } from './client';
import type { CWContact, ApiResponse } from '@/types';
import { useAuthStore } from '@/store/auth';

function accountId() {
  return useAuthStore.getState().user?.chatwootAccountId ?? 0;
}

export async function searchContacts(query: string, page = 1): Promise<ApiResponse<CWContact[]>> {
  const params = new URLSearchParams({ q: query, page: String(page) });
  return cwFetch<ApiResponse<CWContact[]>>(`/accounts/${accountId()}/contacts/search?${params}`);
}

export async function getContact(id: number): Promise<CWContact> {
  return cwFetch<CWContact>(`/accounts/${accountId()}/contacts/${id}`);
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

/**
 * Chatwoot Contacts API — /api/v1/accounts/:accountId/contacts
 */

import { cwFetch } from './client';
import { CHATWOOT_URL } from '@/lib/env';
import { parseContactDetail } from '@/lib/utils/contacts';
import type { CWContact, ApiResponse } from '@/types';
import { useAuthStore } from '@/lib/store/auth';

function accountId() {
  return useAuthStore.getState().user?.chatwootAccountId ?? 0;
}

export type ContactWritePayload = {
  name?: string;
  email?: string;
  phone_number?: string;
  company_name?: string;
  custom_attributes?: Record<string, string>;
};

export async function searchContacts(
  query: string,
  page = 1,
): Promise<ApiResponse<CWContact[]>> {
  const params = new URLSearchParams({ q: query, page: String(page) });
  return cwFetch<ApiResponse<CWContact[]>>(
    `/accounts/${accountId()}/contacts/search?${params}`,
  );
}

export async function getContact(id: number): Promise<CWContact> {
  const res = await cwFetch<unknown>(`/accounts/${accountId()}/contacts/${id}`);
  return parseContactDetail(res);
}

export async function listContacts(page = 1): Promise<ApiResponse<CWContact[]>> {
  return cwFetch<ApiResponse<CWContact[]>>(
    `/accounts/${accountId()}/contacts?page=${page}`,
  );
}

export async function createContact(data: {
  name: string;
  email?: string;
  phone_number?: string;
  company_name?: string;
  custom_attributes?: Record<string, string>;
}): Promise<CWContact> {
  const res = await cwFetch<unknown>(`/accounts/${accountId()}/contacts`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return parseContactDetail(res);
}

export async function updateContact(
  id: number,
  data: ContactWritePayload & Partial<CWContact>,
): Promise<CWContact> {
  const res = await cwFetch<unknown>(`/accounts/${accountId()}/contacts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return parseContactDetail(res);
}

export async function deleteContact(id: number): Promise<void> {
  await cwFetch<void>(`/accounts/${accountId()}/contacts/${id}`, {
    method: 'DELETE',
  });
}

export async function exportContactsCsv(): Promise<Blob> {
  const { tokens } = useAuthStore.getState();
  const res = await fetch(`${CHATWOOT_URL}/api/v1/accounts/${accountId()}/contacts.csv`, {
    headers: {
      ...(tokens?.accessToken ? { api_access_token: tokens.accessToken } : {}),
    },
  });
  if (!res.ok) throw new Error('Export failed');
  return res.blob();
}

export async function importContactsCsv(file: File): Promise<void> {
  const fd = new FormData();
  fd.append('import_file', file);
  await cwFetch<void>(`/accounts/${accountId()}/contacts/import`, {
    method: 'POST',
    body: fd,
  });
}

export async function getContactConversations(contactId: number) {
  return cwFetch<{ payload: unknown[] }>(
    `/accounts/${accountId()}/contacts/${contactId}/conversations`,
  );
}

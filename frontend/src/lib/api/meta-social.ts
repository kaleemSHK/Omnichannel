import { cwFetch } from './client';
import { useAuthStore } from '@/lib/store/auth';

export interface FacebookPageOption {
  id: string;
  name: string;
  access_token: string;
  exists?: boolean;
}

function accountId(): number {
  return useAuthStore.getState().user?.chatwootAccountId ?? 0;
}

export async function fetchFacebookPages(omniauthToken: string): Promise<{
  pages: FacebookPageOption[];
  userAccessToken: string;
}> {
  const aid = accountId();
  const res = await cwFetch<{
    data?: { page_details?: FacebookPageOption[]; user_access_token?: string };
  }>(`/accounts/${aid}/callbacks/facebook_pages`, {
    method: 'POST',
    body: JSON.stringify({ omniauth_token: omniauthToken }),
  });
  const data = res.data ?? {};
  return {
    pages: data.page_details ?? [],
    userAccessToken: data.user_access_token ?? '',
  };
}

export interface RegisteredFacebookInbox {
  id: number;
  name: string;
  channel_type: string;
  channel_id?: number;
  page_id?: string;
}

export async function registerFacebookPage(params: {
  userAccessToken: string;
  pageAccessToken: string;
  pageId: string;
  inboxName: string;
}): Promise<RegisteredFacebookInbox> {
  const aid = accountId();
  return cwFetch<RegisteredFacebookInbox>(
    `/accounts/${aid}/callbacks/register_facebook_page`,
    {
      method: 'POST',
      body: JSON.stringify({
        user_access_token: params.userAccessToken,
        page_access_token: params.pageAccessToken,
        page_id: params.pageId,
        inbox_name: params.inboxName,
      }),
    },
  );
}

export async function startInstagramAuthorization(returnTo?: string): Promise<string> {
  const aid = accountId();
  const res = await cwFetch<{ success?: boolean; url?: string }>(
    `/accounts/${aid}/instagram/authorization`,
    {
      method: 'POST',
      body: JSON.stringify({
        return_to: returnTo || `${window.location.origin}/settings?view=inboxes`,
      }),
    },
  );
  if (!res.success || !res.url) {
    throw new Error('Instagram authorization URL was not returned');
  }
  return res.url;
}

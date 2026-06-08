'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select-radix';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { getFbAppId, facebookLogin } from '@/lib/meta/facebook-sdk';
import {
  fetchFacebookPages,
  registerFacebookPage,
  type RegisteredFacebookInbox,
} from '@/lib/api/meta-social';

interface Props {
  defaultInboxName?: string;
  onConnected: (inbox: RegisteredFacebookInbox) => void;
}

export function MetaFacebookConnect({ defaultInboxName = '', onConnected }: Props) {
  const [loading, setLoading] = useState(false);
  const [pages, setPages] = useState<Awaited<ReturnType<typeof fetchFacebookPages>>['pages']>([]);
  const [userAccessToken, setUserAccessToken] = useState('');
  const [selectedPageId, setSelectedPageId] = useState('');
  const [inboxName, setInboxName] = useState(defaultInboxName);

  const appId = getFbAppId();
  const availablePages = pages.filter(p => !p.exists);

  async function handleFacebookLogin() {
    if (!appId) {
      toast.error('Facebook App ID not configured (NEXT_PUBLIC_FB_APP_ID)');
      return;
    }
    setLoading(true);
    try {
      const token = await facebookLogin(appId);
      const result = await fetchFacebookPages(token);
      setPages(result.pages);
      setUserAccessToken(result.userAccessToken);
      if (!result.pages.length) {
        toast.error('No Facebook pages found for this account');
      } else if (!result.pages.some(p => !p.exists)) {
        toast.message('All pages are already connected');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Facebook login failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect() {
    const page = pages.find(p => p.id === selectedPageId);
    if (!page || !userAccessToken) {
      toast.error('Select a Facebook page');
      return;
    }
    const name = (inboxName || page.name).trim();
    if (!name) {
      toast.error('Inbox name is required');
      return;
    }
    setLoading(true);
    try {
      const inbox = await registerFacebookPage({
        userAccessToken,
        pageAccessToken: page.access_token,
        pageId: page.id,
        inboxName: name,
      });
      toast.success('Facebook Messenger inbox connected');
      onConnected(inbox);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to connect Facebook page');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Connect a Facebook Page for Messenger. If Instagram is linked to the same page, Instagram DMs
        also arrive in this inbox.
      </p>

      {!userAccessToken ? (
        <Button type="button" onClick={handleFacebookLogin} disabled={loading || !appId}>
          {loading && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
          Continue with Facebook
        </Button>
      ) : (
        <>
          <div className="space-y-1">
            <Label className="text-xs">Facebook Page *</Label>
            <Select value={selectedPageId} onValueChange={setSelectedPageId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a page" />
              </SelectTrigger>
              <SelectContent>
                {availablePages.map(page => (
                  <SelectItem key={page.id} value={page.id}>
                    {page.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="fb-inbox-name" className="text-xs">
              Inbox name *
            </Label>
            <Input
              id="fb-inbox-name"
              value={inboxName}
              onChange={e => setInboxName(e.target.value)}
              placeholder="e.g. Facebook Support"
            />
          </div>
          <Button
            type="button"
            onClick={handleConnect}
            disabled={loading || !selectedPageId}
            className="bg-brand-primary hover:bg-brand-primary/90"
          >
            {loading && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
            Connect Messenger inbox
          </Button>
        </>
      )}

      {!appId && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
          Set <code className="font-mono">NEXT_PUBLIC_FB_APP_ID</code> in frontend env (same Meta App
          as Chatwoot <code className="font-mono">FB_APP_ID</code>).
        </p>
      )}
    </div>
  );
}

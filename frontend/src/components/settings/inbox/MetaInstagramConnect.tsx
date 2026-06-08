'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Loader2, Instagram } from 'lucide-react';
import { startInstagramAuthorization } from '@/lib/api/meta-social';

export function MetaInstagramConnect() {
  const [loading, setLoading] = useState(false);

  async function handleConnect() {
    setLoading(true);
    try {
      const url = await startInstagramAuthorization();
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Instagram authorization failed');
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Connect Instagram Business via Meta OAuth. You will be redirected to Instagram, then back to
        BlinkOne when the inbox is created.
      </p>
      <ul className="text-xs text-muted-foreground list-disc ps-4 space-y-1">
        <li>Instagram Professional / Business account required</li>
        <li>Meta App must have Instagram product + webhook at <code>/webhooks/instagram</code></li>
        <li>Configure Instagram App ID/Secret in Chatwoot Super Admin if using v4.1+ login</li>
      </ul>
      <Button
        type="button"
        onClick={handleConnect}
        disabled={loading}
        className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 me-2 animate-spin" />
        ) : (
          <Instagram className="w-4 h-4 me-2" />
        )}
        Continue with Instagram
      </Button>
    </div>
  );
}

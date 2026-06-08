'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { buildWidgetEmbedScript } from '@/lib/api/inboxes';
import { CHATWOOT_URL } from '@/lib/env';

interface Props {
  websiteToken: string;
  inboxName: string;
}

export function InboxWidgetEmbed({ websiteToken, inboxName }: Props) {
  const [copied, setCopied] = useState(false);
  const script = buildWidgetEmbedScript(websiteToken, CHATWOOT_URL);

  async function copy() {
    try {
      await navigator.clipboard.writeText(script);
      setCopied(true);
      toast.success('Embed code copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy — select and copy manually');
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">
        Add the widget to {inboxName}
      </p>
      <p className="text-xs text-muted-foreground">
        Paste this script before the closing <code>&lt;/body&gt;</code> tag on your website — same as
        Chatwoot dashboard.
      </p>
      <pre className="text-[11px] bg-muted/60 border rounded-lg p-3 overflow-x-auto whitespace-pre-wrap font-mono">
        {script}
      </pre>
      <Button type="button" size="sm" variant="outline" onClick={copy} className="gap-1.5">
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? 'Copied' : 'Copy embed code'}
      </Button>
    </div>
  );
}

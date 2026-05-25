'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  listWebhooks,
  createWebhook,
  deleteWebhook,
  type CWWebhook,
} from '@/lib/api/settings';
import { DEMO_WEBHOOKS, settingsDemoDelay } from '@/lib/demo/settingsFixture';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { SectionHeader } from './shared/SectionHeader';
import { ConfirmDialog } from './shared/ConfirmDialog';
import { EmptyState } from './shared/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Sheet } from '@/components/ui/Sheet';
import { Globe, Trash2, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const SUBSCRIPTION_EVENTS = [
  { key: 'conversation_created', label: 'Conversation created' },
  { key: 'conversation_status_changed', label: 'Conversation status changed' },
  { key: 'conversation_updated', label: 'Conversation updated' },
  { key: 'message_created', label: 'Message created' },
  { key: 'conversation_resolved', label: 'Conversation resolved' },
  { key: 'webwidget_triggered', label: 'Web widget triggered' },
] as const;

const schema = z.object({
  url: z.string().url('Enter a valid URL starting with https://'),
});
type WebhookForm = z.infer<typeof schema>;

export function WebhooksSection() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [selectedSubs, setSelectedSubs] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<CWWebhook | null>(null);

  const { data: webhooks = [], isLoading } = useQuery({
    queryKey: ['webhooks'],
    queryFn: async () => {
      if (isDemoDataEnabled()) return DEMO_WEBHOOKS;
      try {
        const list = await listWebhooks();
        return list.length ? list : DEMO_WEBHOOKS;
      } catch {
        return DEMO_WEBHOOKS;
      }
    },
    staleTime: 30_000,
  });

  const { mutate: addWebhook, isPending: adding } = useMutation({
    mutationFn: async ({ url }: { url: string }) => {
      if (isDemoDataEnabled()) {
        await settingsDemoDelay(500);
        return { id: Date.now(), url, subscriptions: selectedSubs };
      }
      return createWebhook({ url, subscriptions: selectedSubs });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhooks'] });
      toast.success('Webhook added');
      setAddOpen(false);
      reset();
      setSelectedSubs([]);
    },
    onError: (e: Error) => toast.error(`Failed to add webhook: ${e.message}`),
  });

  const { mutate: removeWebhook, isPending: deleting } = useMutation({
    mutationFn: async () => {
      if (isDemoDataEnabled()) {
        await settingsDemoDelay(400);
        return;
      }
      await deleteWebhook(deleteTarget!.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhooks'] });
      toast.success('Webhook removed');
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(`Failed to remove webhook: ${e.message}`),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<WebhookForm>({
    resolver: zodResolver(schema),
  });

  function toggleSub(key: string) {
    setSelectedSubs(prev =>
      prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key],
    );
  }

  function copyUrl(url: string) {
    void navigator.clipboard.writeText(url);
    toast.success('URL copied');
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Webhooks"
        description="Receive real-time POST notifications to any HTTPS endpoint."
        actionLabel="Add webhook"
        onAction={() => setAddOpen(true)}
      />

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map(i => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : webhooks.length === 0 ? (
        <EmptyState
          icon={Globe}
          title="No webhooks yet"
          description="Connect external services to receive real-time event notifications."
          actionLabel="Add webhook"
          onAction={() => setAddOpen(true)}
        />
      ) : (
        <div className="space-y-2">
          {webhooks.map(hook => (
            <div
              key={hook.id}
              className="border rounded-lg px-4 py-3 bg-white flex items-start gap-3"
            >
              <Globe size={15} className="text-muted-foreground mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-mono font-medium truncate">{hook.url}</p>
                  <button
                    type="button"
                    onClick={() => copyUrl(hook.url)}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    aria-label="Copy webhook URL"
                  >
                    <Copy size={12} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {hook.subscriptions.map(s => (
                    <Badge key={s} variant="outline" className="text-[10px] px-1.5 py-0">
                      {s.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeleteTarget(hook)}
                className="text-muted-foreground hover:text-destructive transition-colors shrink-0 mt-0.5"
                aria-label="Delete webhook"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Add webhook">
        <form onSubmit={handleSubmit(d => addWebhook(d))} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="webhook-url" className="text-xs">
              Endpoint URL *
            </Label>
            <Input
              id="webhook-url"
              {...register('url')}
              placeholder="https://your-server.com/webhook"
            />
            {errors.url && <p className="text-xs text-destructive">{errors.url.message}</p>}
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Subscribe to events</Label>
            <div className="border rounded-lg divide-y">
              {SUBSCRIPTION_EVENTS.map(({ key, label }) => {
                const checked = selectedSubs.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleSub(key)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 text-start hover:bg-muted/30 transition-colors',
                    )}
                  >
                    <span
                      className={cn(
                        'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                        checked ? 'bg-brand-primary border-brand-primary' : 'border-gray-300',
                      )}
                    >
                      {checked && <Check size={10} className="text-white" />}
                    </span>
                    <span className="text-sm">{label}</span>
                    <code className="text-[10px] text-muted-foreground ms-auto">{key}</code>
                  </button>
                );
              })}
            </div>
            {selectedSubs.length === 0 && (
              <p className="text-xs text-amber-600">Select at least one event to subscribe to.</p>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              type="submit"
              className="bg-brand-primary hover:bg-brand-primary/90 flex-1"
              disabled={adding || selectedSubs.length === 0}
            >
              {adding ? 'Adding…' : 'Add webhook'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setAddOpen(false);
                reset();
                setSelectedSubs([]);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Sheet>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete webhook?"
        description={`This will permanently remove the endpoint "${deleteTarget?.url}". Events will no longer be sent there.`}
        confirmLabel="Delete"
        isPending={deleting}
        onConfirm={() => removeWebhook()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

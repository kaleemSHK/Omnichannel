'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Globe, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';

const schema = z.object({
  url: z.string().url('Enter a valid HTTPS URL'),
});
type WebhookForm = z.infer<typeof schema>;

const EVENT_TYPES = [
  'conversation.created',
  'conversation.resolved',
  'message.created',
  'call.ended',
  'sla.breached',
  'ticket.created',
];

interface Webhook {
  id: string;
  url: string;
  events: string[];
  active: boolean;
}

export function WebhooksSection() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([
    {
      id: '1',
      url: 'https://n8n.labbik.om/webhook/blinkone',
      events: ['message.created', 'call.ended'],
      active: true,
    },
  ]);
  const [showForm, setShowForm] = useState(false);
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<WebhookForm>({
    resolver: zodResolver(schema),
  });

  function onSubmit(data: WebhookForm) {
    const newHook: Webhook = {
      id: Date.now().toString(),
      url: data.url,
      events: selectedEvents,
      active: true,
    };
    setWebhooks(prev => [...prev, newHook]);
    reset();
    setSelectedEvents([]);
    setShowForm(false);
    toast.success('Webhook added');
  }

  function toggleEvent(event: string) {
    setSelectedEvents(prev =>
      prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event],
    );
  }

  function deleteWebhook(id: string) {
    setWebhooks(prev => prev.filter(w => w.id !== id));
    toast.success('Webhook removed');
  }

  function toggleActive(id: string) {
    setWebhooks(prev => prev.map(w => (w.id === id ? { ...w, active: !w.active } : w)));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Webhooks</h1>
          <p className="text-sm text-muted-foreground mt-1">
            POST event payloads to external URLs (e.g. n8n, Zapier, custom).
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => setShowForm(v => !v)}
          className="bg-brand-primary hover:bg-brand-primary/90 text-sm"
        >
          <Plus size={14} className="me-1.5" />
          Add webhook
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit(onSubmit)} className="border rounded-lg p-4 space-y-4 bg-muted/20">
          <div className="space-y-1.5">
            <Label>Endpoint URL</Label>
            <Input {...register('url')} placeholder="https://your-server.com/webhook" />
            {errors.url && <p className="text-xs text-destructive">{errors.url.message}</p>}
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Events to subscribe</Label>
            <div className="grid grid-cols-2 gap-2">
              {EVENT_TYPES.map(event => (
                <label key={event} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedEvents.includes(event)}
                    onChange={() => toggleEvent(event)}
                    className="rounded"
                  />
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{event}</code>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" className="bg-brand-primary hover:bg-brand-primary/90">
              Save webhook
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {webhooks.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            <Globe size={32} className="mx-auto mb-3 opacity-30" />
            No webhooks configured
          </div>
        )}
        {webhooks.map(hook => (
          <div key={hook.id} className="border rounded-lg px-4 py-3 flex items-start gap-3 bg-white">
            <Globe size={16} className="text-muted-foreground mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium font-mono truncate">{hook.url}</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {hook.events.map(e => (
                  <code key={e} className="text-[11px] bg-muted px-1.5 py-0.5 rounded">
                    {e}
                  </code>
                ))}
              </div>
            </div>
            <Switch checked={hook.active} onCheckedChange={() => toggleActive(hook.id)} />
            <button
              type="button"
              onClick={() => deleteWebhook(hook.id)}
              className="text-muted-foreground hover:text-destructive transition-colors ms-1"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

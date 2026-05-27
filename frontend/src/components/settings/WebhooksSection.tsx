'use client';

/**
 * WebhooksSection — Sprint 3 N1
 * Full outbound webhook management: endpoints, delivery log, retry, test, HMAC docs.
 */

import { useState } from 'react';
import { Globe, Plus, Trash2, Send, Copy, ChevronDown, ChevronUp, RefreshCw, Check, AlertTriangle, XCircle, Clock, ShieldCheck } from 'lucide-react';
import { useWebhookEndpoints, useCreateWebhookEndpoint, useUpdateWebhookEndpoint, useDeleteWebhookEndpoint, useTestWebhookEndpoint, useDeliveries, useRetryDelivery } from '@/lib/hooks/useWebhooks';
import { WEBHOOK_EVENTS } from '@/lib/api/webhooks';
import { SectionHeader } from './shared/SectionHeader';
import { EmptyState } from './shared/EmptyState';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import type { WebhookEndpoint, WebhookCreateResult, WebhookDelivery, DeliveryStatus } from '@/lib/api/webhooks';

// ─── Delivery status helpers ──────────────────────────────────────────────────

const STATUS_ICON: Record<DeliveryStatus, React.ElementType> = {
  succeeded: Check,
  pending:   Clock,
  failed:    AlertTriangle,
  dead:      XCircle,
};

const STATUS_CLASS: Record<DeliveryStatus, string> = {
  succeeded: 'text-green-600 bg-green-50',
  pending:   'text-blue-600 bg-blue-50',
  failed:    'text-amber-600 bg-amber-50',
  dead:      'text-red-600 bg-red-50',
};

function DeliveryRow({ delivery }: { delivery: WebhookDelivery }) {
  const retry    = useRetryDelivery();
  const Icon     = STATUS_ICON[delivery.status];
  const canRetry = delivery.status === 'failed' || delivery.status === 'dead';

  return (
    <tr className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
      <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap tabular-nums">
        {delivery.attemptedAt
          ? new Date(delivery.attemptedAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
          : '—'}
      </td>
      <td className="px-4 py-2.5 max-w-[180px]">
        <code className="text-xs text-gray-700 truncate block">{delivery.eventType}</code>
      </td>
      <td className="px-4 py-2.5">
        <span className={cn('inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full', STATUS_CLASS[delivery.status])}>
          <Icon size={9} />
          {delivery.status}
        </span>
      </td>
      <td className="px-4 py-2.5 text-xs text-gray-500 tabular-nums">
        {delivery.responseStatus ?? '—'}
      </td>
      <td className="px-4 py-2.5 text-xs text-gray-400">
        {delivery.attempt} / 6
      </td>
      <td className="px-4 py-2.5">
        {canRetry && (
          <button
            type="button"
            onClick={() => retry.mutate(delivery.id)}
            disabled={retry.isPending}
            className="flex items-center gap-1 text-xs text-blue-600 hover:underline disabled:opacity-50"
          >
            <RefreshCw size={10} className={retry.isPending ? 'animate-spin' : ''} />
            Retry
          </button>
        )}
      </td>
    </tr>
  );
}

// ─── Endpoint card ────────────────────────────────────────────────────────────

function EndpointCard({
  endpoint,
  onDelete,
}: {
  endpoint: WebhookEndpoint;
  onDelete: (ep: WebhookEndpoint) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const update   = useUpdateWebhookEndpoint();
  const testMut  = useTestWebhookEndpoint();

  const toggleEnabled = () =>
    update.mutate({ id: endpoint.id, data: { enabled: !endpoint.enabled } });

  return (
    <div className={cn(
      'border rounded-lg bg-white overflow-hidden',
      !endpoint.enabled && 'opacity-70',
    )}>
      <div className="flex items-start gap-3 px-4 py-3">
        <Globe size={15} className="text-muted-foreground mt-0.5 shrink-0" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-800">{endpoint.name}</p>
            {!endpoint.enabled && (
              <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Disabled</span>
            )}
          </div>
          <p className="text-xs font-mono text-gray-500 truncate mt-0.5">{endpoint.url}</p>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {endpoint.eventsSubscribed.map(e => (
              <Badge key={e} variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                {e}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Enable/disable toggle */}
          <button
            type="button"
            role="switch"
            aria-checked={endpoint.enabled}
            onClick={toggleEnabled}
            disabled={update.isPending}
            title={endpoint.enabled ? 'Disable' : 'Enable'}
            className={cn(
              'relative w-9 h-5 rounded-full transition-colors',
              endpoint.enabled ? 'bg-[#0B5FFF]' : 'bg-gray-300',
            )}
          >
            <span className={cn(
              'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
              endpoint.enabled ? 'translate-x-4' : 'translate-x-0.5',
            )} />
          </button>

          {/* Test */}
          <button
            type="button"
            title="Send test event"
            disabled={testMut.isPending || !endpoint.enabled}
            onClick={() => testMut.mutate(endpoint.id)}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-blue-600 transition-colors disabled:opacity-40"
          >
            <Send size={13} />
          </button>

          {/* Delete */}
          <button
            type="button"
            title="Delete endpoint"
            onClick={() => onDelete(endpoint)}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-colors"
          >
            <Trash2 size={13} />
          </button>

          {/* Expand deliveries */}
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 transition-colors"
            title="View delivery log"
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {/* Inline delivery summary */}
      {expanded && (
        <EndpointDeliveries endpointId={endpoint.id} />
      )}
    </div>
  );
}

function EndpointDeliveries({ endpointId }: { endpointId: string }) {
  const { data: deliveries = [], isLoading } = useWebhookEndpointDeliveries(endpointId);

  if (isLoading) return <div className="px-4 py-3 text-xs text-gray-400 border-t">Loading…</div>;
  if (!deliveries.length) return (
    <div className="px-4 py-3 text-xs text-gray-400 border-t border-gray-100">
      No deliveries recorded yet.
    </div>
  );

  return (
    <div className="border-t border-gray-100">
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Time', 'Event', 'Status', 'HTTP', 'Attempt', ''].map(h => (
                <th key={h} className="px-4 py-2 text-start text-[10px] font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {deliveries.slice(0, 10).map(d => <DeliveryRow key={d.id} delivery={d} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Create endpoint sheet ────────────────────────────────────────────────────

function CreateEndpointSheet({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (result: WebhookCreateResult) => void;
}) {
  const [name, setName]     = useState('');
  const [url, setUrl]       = useState('');
  const [events, setEvents] = useState<string[]>([]);
  const [urlError, setUrlError] = useState('');

  const create = useCreateWebhookEndpoint(result => { onCreated(result); resetForm(); });

  const resetForm = () => { setName(''); setUrl(''); setEvents([]); setUrlError(''); onClose(); };

  const toggleEvent = (key: string) =>
    setEvents(prev => prev.includes(key) ? prev.filter(e => e !== key) : [...prev, key]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setUrlError('');
    try { new URL(url); } catch { setUrlError('Enter a valid https:// URL'); return; }
    if (!url.startsWith('https://') && !url.startsWith('http://localhost')) {
      setUrlError('URL must start with https://');
      return;
    }
    if (!events.length) return;
    create.mutate({ name: name.trim() || 'Webhook', url: url.trim(), eventsSubscribed: events });
  };

  const groups = [...new Set(WEBHOOK_EVENTS.map(e => e.group))];

  return (
    <Sheet open={open} onClose={resetForm} title="Add webhook endpoint">
      <form onSubmit={submit} className="space-y-5">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-700">Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="CRM Sync"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-700">Endpoint URL *</label>
          <input
            required
            value={url}
            onChange={e => { setUrl(e.target.value); setUrlError(''); }}
            placeholder="https://your-server.com/webhook"
            className={cn(
              'w-full px-3 py-2 text-sm border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500',
              urlError ? 'border-red-400' : 'border-gray-200',
            )}
          />
          {urlError && <p className="text-xs text-red-600">{urlError}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-700">Subscribe to events *</label>
          {groups.map(group => (
            <div key={group} className="space-y-1">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">{group}</p>
              <div className="border rounded-lg divide-y">
                {WEBHOOK_EVENTS.filter(e => e.group === group).map(({ key, label }) => {
                  const checked = events.includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleEvent(key)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-start hover:bg-muted/30 transition-colors"
                    >
                      <span className={cn(
                        'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0',
                        checked ? 'bg-[#0B5FFF] border-[#0B5FFF]' : 'border-gray-300',
                      )}>
                        {checked && <Check size={10} className="text-white" />}
                      </span>
                      <span className="text-sm flex-1">{label}</span>
                      <code className="text-[10px] text-muted-foreground">{key}</code>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {events.length === 0 && (
            <p className="text-xs text-amber-600">Select at least one event.</p>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            type="submit"
            className="flex-1"
            disabled={create.isPending || events.length === 0}
          >
            {create.isPending ? 'Creating…' : 'Create endpoint'}
          </Button>
          <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
        </div>
      </form>
    </Sheet>
  );
}

// ─── Secret reveal dialog ─────────────────────────────────────────────────────

function SecretRevealDialog({
  result,
  onClose,
}: {
  result: WebhookCreateResult | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  if (!result) return null;

  const copy = () => {
    void navigator.clipboard.writeText(result.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-center gap-2 text-green-700">
          <ShieldCheck size={20} />
          <h3 className="font-semibold">Endpoint created — save your secret</h3>
        </div>
        <p className="text-sm text-gray-600">
          This signing secret is shown <strong>only once</strong>. Copy it now and store it securely.
          Use it to verify the <code className="bg-gray-100 px-1 rounded">X-BlinkOne-Signature</code> header on each delivery.
        </p>
        <div className="relative">
          <code className="block bg-gray-100 rounded-lg p-3 text-xs font-mono break-all pr-10">
            {result.secret}
          </code>
          <button
            type="button"
            onClick={copy}
            className="absolute top-2 right-2 p-1.5 rounded hover:bg-gray-200 text-gray-500"
            title="Copy secret"
          >
            {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
          </button>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
          Signature format: <code>t=&lt;unix_ts&gt;,v1=HMAC-SHA256(secret, &ldquo;{'{'}t{'}'}.{'{'}rawBody{'}'}&rdquo;)</code>
        </div>
        <Button className="w-full" onClick={onClose}>Got it, close</Button>
      </div>
    </div>
  );
}

// ─── Delivery log tab ─────────────────────────────────────────────────────────

function DeliveryLogTab() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { data: deliveries = [], isLoading, refetch, isFetching } = useDeliveries(100);

  const filtered = statusFilter === 'all'
    ? deliveries
    : deliveries.filter(d => d.status === statusFilter);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          {(['all', 'succeeded', 'failed', 'dead', 'pending'] as const).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-2.5 py-1 rounded text-xs capitalize border',
                statusFilter === s
                  ? 'bg-[#0B5FFF] text-white border-[#0B5FFF]'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50',
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
        >
          <RefreshCw size={11} className={isFetching ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Time', 'Event', 'Status', 'HTTP', 'Attempt', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-start text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="py-12 text-center text-sm text-gray-400">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-sm text-gray-400">No deliveries found.</td></tr>
              ) : (
                filtered.map(d => <DeliveryRow key={d.id} delivery={d} />)
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-[10px] text-gray-400 text-end">
        Showing {filtered.length} of {deliveries.length} deliveries · auto-refreshes every 30 s
      </p>
    </div>
  );
}

// ─── Security tab ─────────────────────────────────────────────────────────────

function SecurityTab() {
  return (
    <div className="space-y-4 max-w-2xl text-sm text-gray-700">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-1 flex items-center gap-2">
          <ShieldCheck size={14} /> HMAC-SHA256 Signature Verification
        </h4>
        <p className="text-xs text-blue-700">
          Every delivery includes an <code>X-BlinkOne-Signature</code> header. Verify it to ensure
          payloads originate from BlinkOne and have not been tampered with.
        </p>
      </div>

      <div className="space-y-3">
        <h5 className="font-medium text-gray-800">Header format</h5>
        <pre className="bg-gray-100 rounded-lg p-3 text-xs font-mono overflow-x-auto">
{`X-BlinkOne-Signature: t=1710000000,v1=abc123def456...`}
        </pre>

        <h5 className="font-medium text-gray-800">Verification algorithm</h5>
        <pre className="bg-gray-100 rounded-lg p-3 text-xs font-mono overflow-x-auto">
{`// 1. Extract timestamp and signature from header
const parts = header.split(',');
const t  = parts.find(p => p.startsWith('t=')).slice(2);
const v1 = parts.find(p => p.startsWith('v1=')).slice(3);

// 2. Build signed payload
const signedPayload = \`\${t}.\${rawBody}\`;

// 3. Compute expected HMAC
const expected = crypto
  .createHmac('sha256', webhookSecret)
  .update(signedPayload)
  .digest('hex');

// 4. Constant-time comparison
const valid = crypto.timingSafeEqual(
  Buffer.from(v1), Buffer.from(expected)
);

// 5. Optional: reject if |now - t| > 300 (replay protection)
const skew = Math.abs(Date.now() / 1000 - Number(t));
if (skew > 300) throw new Error('Timestamp too old');`}
        </pre>

        <div className="grid sm:grid-cols-2 gap-3 text-xs text-gray-600">
          <div className="border rounded-lg p-3">
            <p className="font-medium text-gray-700 mb-1">Retry schedule</p>
            <p>Failed deliveries are retried up to 6 times with exponential back-off:</p>
            <p className="font-mono mt-1">1 min → 5 min → 30 min → 2 h → 12 h → 24 h</p>
            <p className="mt-1">After 6 failed attempts the delivery is marked <code>dead</code>.</p>
          </div>
          <div className="border rounded-lg p-3">
            <p className="font-medium text-gray-700 mb-1">Success criteria</p>
            <p>BlinkOne considers a delivery successful when your endpoint returns HTTP <code>2xx</code> within 10 seconds.</p>
            <p className="mt-1">Any other response code or timeout is treated as a failure and triggers a retry.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

type Tab = 'endpoints' | 'deliveries' | 'security';

// Import the hook we need for the inline delivery expansion
import { useEndpointDeliveries as useWebhookEndpointDeliveries } from '@/lib/hooks/useWebhooks';

function DeleteConfirm({ endpoint, onConfirm, onCancel }: { endpoint: WebhookEndpoint; onConfirm: () => void; onCancel: () => void }) {
  const del = useDeleteWebhookEndpoint();
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">Delete webhook endpoint?</h3>
        <p className="text-sm text-gray-600">
          This will permanently remove <strong>{endpoint.name}</strong> ({endpoint.url}).
          All pending deliveries will be cancelled.
        </p>
        <div className="flex gap-2">
          <Button
            className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            disabled={del.isPending}
            onClick={() => del.mutate(endpoint.id, { onSuccess: onConfirm })}
          >
            {del.isPending ? 'Deleting…' : 'Delete'}
          </Button>
          <Button variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}

export function WebhooksSection() {
  const [activeTab, setActiveTab] = useState<Tab>('endpoints');
  const [createOpen, setCreateOpen]   = useState(false);
  const [newSecret, setNewSecret]     = useState<WebhookCreateResult | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WebhookEndpoint | null>(null);

  const { data: endpoints = [], isLoading } = useWebhookEndpoints();

  const TABS: { id: Tab; label: string }[] = [
    { id: 'endpoints',  label: 'Endpoints' },
    { id: 'deliveries', label: 'Delivery log' },
    { id: 'security',   label: 'Security' },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Webhooks"
        description="Receive real-time POST notifications signed with HMAC-SHA256."
        actionLabel="Add endpoint"
        onAction={() => setCreateOpen(true)}
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={cn(
              'px-4 py-2 text-sm -mb-px border-b-2 transition-colors',
              activeTab === t.id
                ? 'border-[#0B5FFF] text-[#0B5FFF] font-medium'
                : 'border-transparent text-gray-500 hover:text-gray-700',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Endpoints tab */}
      {activeTab === 'endpoints' && (
        <>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2].map(i => <div key={i} className="h-20 rounded-lg bg-gray-100 animate-pulse" />)}
            </div>
          ) : endpoints.length === 0 ? (
            <EmptyState
              icon={Globe}
              title="No webhook endpoints"
              description="Add an endpoint to start receiving real-time event notifications."
              actionLabel="Add endpoint"
              onAction={() => setCreateOpen(true)}
            />
          ) : (
            <div className="space-y-2">
              {endpoints.map(ep => (
                <EndpointCard
                  key={ep.id}
                  endpoint={ep}
                  onDelete={setDeleteTarget}
                />
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'deliveries' && <DeliveryLogTab />}
      {activeTab === 'security'   && <SecurityTab />}

      {/* Create sheet */}
      <CreateEndpointSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={result => { setCreateOpen(false); setNewSecret(result); }}
      />

      {/* Secret reveal dialog */}
      <SecretRevealDialog result={newSecret} onClose={() => setNewSecret(null)} />

      {/* Delete confirm */}
      {deleteTarget && (
        <DeleteConfirm
          endpoint={deleteTarget}
          onConfirm={() => setDeleteTarget(null)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

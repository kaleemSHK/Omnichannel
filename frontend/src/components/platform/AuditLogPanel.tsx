'use client';

/**
 * AuditLogPanel — P1 Platform Admin
 * Paginated, filterable audit event table.
 */

import { useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { useAuditLog } from '@/lib/hooks/usePlatform';
import { cn } from '@/lib/utils/cn';
import type { AuditEvent } from '@/lib/api/platform';

const ACTION_CHIP: Record<string, string> = {
  'tenant.created':         'bg-green-50 text-green-700',
  'tenant.feature_updated': 'bg-blue-50 text-blue-700',
  'tenant.status_changed':  'bg-amber-50 text-amber-700',
  'tenant.impersonated':    'bg-purple-50 text-purple-700',
  'api_key.created':        'bg-indigo-50 text-indigo-700',
  'admin.invited':          'bg-teal-50 text-teal-700',
  'alert.created':          'bg-orange-50 text-orange-700',
  'branding.updated':       'bg-pink-50 text-pink-700',
};

function EventRow({ evt }: { evt: AuditEvent }) {
  const chipClass = ACTION_CHIP[evt.action] ?? 'bg-gray-100 text-gray-600';
  return (
    <tr className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
      <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap tabular-nums">
        {new Date(evt.ts).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
      </td>
      <td className="px-4 py-2.5">
        <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', chipClass)}>
          {evt.action}
        </span>
      </td>
      <td className="px-4 py-2.5 text-xs text-gray-600">
        {evt.resourceType}
      </td>
      <td className="px-4 py-2.5 text-xs text-gray-500">
        {evt.tenantId ? `#${evt.tenantId}` : '—'}
      </td>
      <td className="px-4 py-2.5 text-xs text-gray-500 truncate max-w-[160px]">
        {evt.actorEmail ?? '—'}
      </td>
    </tr>
  );
}

const LIMITS = [50, 100, 200] as const;

export function AuditLogPanel() {
  const [limit, setLimit] = useState<(typeof LIMITS)[number]>(100);
  const [search, setSearch] = useState('');
  const { data: events = [], isLoading } = useAuditLog(limit);

  const filtered = search.trim()
    ? events.filter(e =>
        e.action.includes(search.toLowerCase()) ||
        (e.actorEmail ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (e.resourceType ?? '').toLowerCase().includes(search.toLowerCase()),
      )
    : events;

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter by action, actor…"
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>Show</span>
          {LIMITS.map(l => (
            <button
              key={l}
              type="button"
              onClick={() => setLimit(l)}
              className={cn(
                'px-2.5 py-1 rounded border text-xs',
                limit === l
                  ? 'bg-[#0B5FFF] text-white border-[#0B5FFF]'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50',
              )}
            >
              {l}
            </button>
          ))}
          <span>events</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Timestamp', 'Action', 'Resource type', 'Tenant', 'Actor'].map(h => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-start text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <Loader2 className="animate-spin text-gray-400 mx-auto" size={22} />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-sm text-gray-400">
                    No audit events found.
                  </td>
                </tr>
              ) : (
                filtered.map(evt => <EventRow key={evt.id} evt={evt} />)
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[10px] text-gray-400 text-end">
        Showing {filtered.length} of {events.length} events
      </p>
    </div>
  );
}

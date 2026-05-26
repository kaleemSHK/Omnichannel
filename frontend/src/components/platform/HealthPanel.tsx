'use client';

/**
 * HealthPanel — P1 Platform Admin
 * Real-time service health status for all microservices.
 * Polls every 60 s via React Query refetchInterval.
 */

import { RefreshCw } from 'lucide-react';
import { useHealthAll } from '@/lib/hooks/usePlatform';
import { cn } from '@/lib/utils/cn';
import type { ServiceHealthEntry } from '@/lib/api/platform';

const STATUS_DOT: Record<ServiceHealthEntry['status'], string> = {
  up:       'bg-green-500',
  down:     'bg-red-500',
  degraded: 'bg-amber-500',
  unknown:  'bg-gray-400',
};

const STATUS_LABEL: Record<ServiceHealthEntry['status'], string> = {
  up:       'Healthy',
  down:     'Down',
  degraded: 'Degraded',
  unknown:  'Unknown',
};

const STATUS_ROW: Record<ServiceHealthEntry['status'], string> = {
  up:       '',
  down:     'bg-red-50',
  degraded: 'bg-amber-50',
  unknown:  '',
};

const SERVICE_LABELS: Record<string, string> = {
  gateway:     'Gateway (RBAC proxy)',
  routing:     'Routing (ACD / queues)',
  ivr:         'IVR builder',
  ai:          'AI (LLM / STT / TTS)',
  sla:         'SLA engine',
  billing:     'Billing',
  integration: 'Integration (webhooks)',
  calls:       'Calls (CDR)',
  recording:   'Recording',
  tenant:      'Tenant provisioning',
};

function ServiceRow({ svc }: { svc: ServiceHealthEntry }) {
  return (
    <div className={cn('flex items-center justify-between gap-3 py-3 px-4 border-b border-gray-100 last:border-0', STATUS_ROW[svc.status])}>
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={cn('w-2.5 h-2.5 rounded-full shrink-0 animate-none', STATUS_DOT[svc.status], svc.status === 'down' && 'animate-pulse')} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">
            {SERVICE_LABELS[svc.name] ?? svc.name}
          </p>
          {svc.error && (
            <p className="text-[10px] text-red-600 truncate">{svc.error}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-xs text-gray-400 tabular-nums">{svc.latency_ms} ms</span>
        <span className={cn(
          'text-[10px] font-medium px-2 py-0.5 rounded-full',
          svc.status === 'up'       ? 'bg-green-50 text-green-700' :
          svc.status === 'down'     ? 'bg-red-50 text-red-700' :
          svc.status === 'degraded' ? 'bg-amber-50 text-amber-700' :
                                      'bg-gray-100 text-gray-500',
        )}>
          {STATUS_LABEL[svc.status]}
        </span>
      </div>
    </div>
  );
}

export function HealthPanel() {
  const { data, isLoading, isFetching, dataUpdatedAt, refetch } = useHealthAll();

  const overall   = data?.overall ?? 'degraded';
  const services  = data?.services ?? [];
  const upCount   = services.filter(s => s.status === 'up').length;
  const lastCheck = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : '—';

  return (
    <div className="space-y-4">
      {/* Overall status banner */}
      <div className={cn(
        'rounded-lg border p-4 flex items-center justify-between gap-4',
        overall === 'healthy' ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200',
      )}>
        <div>
          <p className={cn('text-sm font-semibold', overall === 'healthy' ? 'text-green-800' : 'text-amber-800')}>
            {overall === 'healthy' ? '✓ All systems operational' : '⚠ One or more services degraded'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {upCount} / {services.length} services up · Last checked {lastCheck}
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-800 px-3 py-1.5 border border-gray-200 rounded-md bg-white hover:bg-gray-50 transition-colors"
        >
          <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Service list */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-gray-400">Checking services…</div>
        ) : services.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">No services configured.</div>
        ) : (
          services.map(svc => <ServiceRow key={svc.name} svc={svc} />)
        )}
      </div>
    </div>
  );
}

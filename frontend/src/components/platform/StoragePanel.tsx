'use client';

/**
 * StoragePanel — P1 Platform Admin
 * Per-tenant storage usage breakdown with visual progress bars.
 */

import { Loader2, HardDrive } from 'lucide-react';
import { useStorageStats } from '@/lib/hooks/usePlatform';
import { planLabel } from '@/lib/utils/platform';
import { cn } from '@/lib/utils/cn';
import type { StorageTenantStat } from '@/lib/api/platform';

function UsageBar({
  label,
  gb,
  color,
}: {
  label: string;
  gb: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={cn('w-2 h-2 rounded-full shrink-0', color)} />
      <span className="text-gray-500 w-20 shrink-0">{label}</span>
      <span className="font-medium text-gray-700 tabular-nums">{gb} GB</span>
    </div>
  );
}

function TenantStorageCard({ stat }: { stat: StorageTenantStat }) {
  const pct = Math.min(100, Math.round((stat.total_gb / stat.quota_gb) * 100));
  const isNearFull = pct >= 80;
  const isOverQuota = pct >= 100;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">{stat.tenantName}</p>
          <p className="text-[10px] text-gray-400">{planLabel(stat.plan as Parameters<typeof planLabel>[0])} · quota {stat.quota_gb} GB</p>
        </div>
        <div className="text-end shrink-0">
          <p className={cn(
            'text-lg font-bold tabular-nums',
            isOverQuota ? 'text-red-600' : isNearFull ? 'text-amber-600' : 'text-gray-800',
          )}>
            {stat.total_gb} GB
          </p>
          <p className="text-[10px] text-gray-400">{pct}% used</p>
        </div>
      </div>

      {/* Stacked usage bar */}
      <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden flex">
        <div
          className="bg-blue-500 h-full"
          style={{ width: `${Math.min(100, (stat.recordings_gb / stat.quota_gb) * 100)}%` }}
        />
        <div
          className="bg-purple-400 h-full"
          style={{ width: `${Math.min(100, (stat.ai_gb / stat.quota_gb) * 100)}%` }}
        />
        <div
          className="bg-amber-400 h-full"
          style={{ width: `${Math.min(100, (stat.assets_gb / stat.quota_gb) * 100)}%` }}
        />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <UsageBar label="Recordings" gb={stat.recordings_gb} color="bg-blue-500" />
        <UsageBar label="AI / RAG"   gb={stat.ai_gb}         color="bg-purple-400" />
        <UsageBar label="Assets"     gb={stat.assets_gb}     color="bg-amber-400" />
      </div>

      {isNearFull && (
        <p className={cn(
          'text-[10px] font-medium rounded px-2 py-1',
          isOverQuota ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700',
        )}>
          {isOverQuota ? '⚠ Over quota — upgrade plan or purge data' : '⚠ Approaching quota limit'}
        </p>
      )}
    </div>
  );
}

export function StoragePanel() {
  const { data: stats = [], isLoading } = useStorageStats();

  const totalUsed  = stats.reduce((s, r) => s + r.total_gb, 0);
  const totalQuota = stats.reduce((s, r) => s + r.quota_gb, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <HardDrive size={16} className="text-gray-500" />
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Storage usage</h3>
          {!isLoading && (
            <p className="text-xs text-gray-500">
              {totalUsed} GB used across all tenants · {totalQuota} GB total quota
            </p>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-gray-400" size={24} />
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {stats.map(s => (
            <TenantStorageCard key={s.tenantId} stat={s} />
          ))}
          {stats.length === 0 && (
            <p className="col-span-2 text-sm text-gray-400 text-center py-10">No storage data available.</p>
          )}
        </div>
      )}
    </div>
  );
}

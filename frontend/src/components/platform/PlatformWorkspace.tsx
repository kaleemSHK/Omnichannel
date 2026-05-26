'use client';

import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Plus, Search } from 'lucide-react';
import { PlatformKPICards } from '@/components/platform/PlatformKPICards';
import { TenantCard } from '@/components/platform/TenantCard';
import { NewTenantWizard } from '@/components/platform/NewTenantWizard';
import { FeatureFlagsMatrix } from '@/components/platform/FeatureFlagsMatrix';
import { AdminsPanel } from '@/components/platform/AdminsPanel';
import { StoragePanel } from '@/components/platform/StoragePanel';
import { HealthPanel } from '@/components/platform/HealthPanel';
import { AuditLogPanel } from '@/components/platform/AuditLogPanel';
import { AlertsPanel } from '@/components/platform/AlertsPanel';
import { DemoBanner } from '@/components/ui/DemoBanner';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { usePlatformKpis, usePlatformTenants } from '@/lib/hooks/usePlatform';
import { useAuthStore } from '@/lib/store/auth';
import { cn } from '@/lib/utils/cn';

type PlatformTab = 'tenants' | 'flags' | 'admins' | 'storage' | 'health' | 'audit' | 'alerts';

const NAV: { id: PlatformTab; label: string }[] = [
  { id: 'tenants', label: 'Tenants' },
  { id: 'flags',   label: 'Feature flags' },
  { id: 'admins',  label: 'Admins' },
  { id: 'storage', label: 'Storage' },
  { id: 'health',  label: 'Health' },
];

const NAV_SECONDARY: { id: PlatformTab; label: string }[] = [
  { id: 'audit',  label: 'Audit log' },
  { id: 'alerts', label: 'Alerts' },
];

export function PlatformWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore(s => s.user);
  const hydrated = useAuthStore(s => s.hydrated);
  const hydrateFromSession = useAuthStore(s => s.hydrateFromSession);
  const tab = (searchParams.get('tab') as PlatformTab) || 'tenants';

  const { data: tenants = [], isLoading } = usePlatformTenants();
  const kpis = usePlatformKpis(tenants);
  const [search, setSearch] = useState('');
  const [wizardOpen, setWizardOpen] = useState(false);
  const demoMode = isDemoDataEnabled();

  useLayoutEffect(() => {
    hydrateFromSession();
  }, [hydrateFromSession]);

  useEffect(() => {
    if (!hydrated) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.role !== 'platform_admin' && !demoMode) {
      router.replace('/conversations');
    }
  }, [hydrated, user, router, demoMode]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter(
      t => t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q),
    );
  }, [tenants, search]);

  const setTab = (id: PlatformTab) => {
    router.push(id === 'tenants' ? '/platform' : `/platform?tab=${id}`);
  };

  if (!user || (user.role !== 'platform_admin' && !demoMode)) {
    return null;
  }

  return (
    <div className="flex h-full min-h-[calc(100vh-3rem)] bg-surface-tertiary">
      <nav className="w-[170px] shrink-0 bg-white border-e border-gray-200 py-3 px-2 flex flex-col">
        {NAV.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              'w-full text-start px-2.5 py-2 rounded-md text-sm mb-0.5',
              tab === item.id ? 'bg-blue-50 text-[#0B5FFF] font-medium' : 'text-gray-600 hover:bg-gray-50',
            )}
          >
            {item.label}
          </button>
        ))}
        <div className="my-2 border-t border-gray-100" />
        {NAV_SECONDARY.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              'w-full text-start px-2.5 py-2 rounded-md text-sm mb-0.5',
              tab === item.id ? 'bg-blue-50 text-[#0B5FFF] font-medium' : 'text-gray-600 hover:bg-gray-50',
            )}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        {demoMode && (
          <DemoBanner label="Platform admin demo (4 sample tenants). Use a platform_admin account in production." />
        )}

        {tab === 'tenants' && (
          <>
            <PlatformKPICards kpis={kpis} />
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <div className="relative max-w-md flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search tenants…"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md bg-white"
                />
              </div>
              <button
                type="button"
                onClick={() => setWizardOpen(true)}
                className="inline-flex items-center justify-center gap-1 px-3 py-2 text-sm bg-[#0B5FFF] text-white rounded-md hover:bg-blue-700"
              >
                <Plus size={16} />
                New tenant
              </button>
            </div>
            {isLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="animate-spin text-gray-400" size={28} />
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map(t => (
                  <TenantCard key={t.id} tenant={t} />
                ))}
                {!filtered.length && (
                  <p className="text-sm text-gray-500 text-center py-8">No tenants match your search.</p>
                )}
              </div>
            )}
          </>
        )}

        {tab === 'flags'   && <FeatureFlagsMatrix />}
        {tab === 'admins'  && <AdminsPanel />}
        {tab === 'storage' && <StoragePanel />}
        {tab === 'health'  && <HealthPanel />}
        {tab === 'audit'   && <AuditLogPanel />}
        {tab === 'alerts'  && <AlertsPanel />}
      </div>

      <NewTenantWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  );
}

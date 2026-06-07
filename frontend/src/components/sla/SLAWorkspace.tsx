'use client';

import { useState } from 'react';
import { AlertCircle, PlusCircle } from 'lucide-react';
import { SLAKPICards } from '@/components/sla/SLAKPICards';
import { SLAInstanceTable } from '@/components/sla/SLAInstanceTable';
import { PolicyCard } from '@/components/sla/PolicyCard';
import { PolicyFormModal } from '@/components/sla/PolicyFormModal';
import { SlaCalendarsSection } from '@/components/sla/SlaCalendarsSection';
import { Button } from '@/components/ui/button';
import {
  instancesForFilter,
  useSlaDashboard,
  useSlaPolicies,
  useSlaBreachAlerts,
  type SlaFilter,
} from '@/lib/hooks/useSla';
import { cn } from '@/lib/utils/cn';

const NAV: { id: SlaFilter | 'policies' | 'hours'; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'breached',  label: 'Breached' },
  { id: 'at_risk',   label: 'At risk' },
  { id: 'active',    label: 'Active' },
  { id: 'met',       label: 'Met' },
];

export function SLAWorkspace() {
  const [view, setView] = useState<SlaFilter | 'policies' | 'hours'>('dashboard');
  const [newPolicyOpen, setNewPolicyOpen] = useState(false);

  const { data, isLoading, isError, error, refetch } = useSlaDashboard();
  const { data: policies = [] } = useSlaPolicies();

  // Fires toast notifications on new breaches (side-effect hook, no render output)
  useSlaBreachAlerts();

  const stats = data?.stats ?? {
    breachedCount: 0,
    atRiskCount: 0,
    activeCount: 0,
    metToday: 0,
    compliancePct: 0,
  };

  const badge = (id: SlaFilter) => {
    if (id === 'breached') return stats.breachedCount;
    if (id === 'at_risk')  return stats.atRiskCount;
    if (id === 'active')   return stats.activeCount;
    if (id === 'met')      return stats.metToday;
    return 0;
  };

  const tableFilter: SlaFilter =
    view === 'dashboard' ? 'dashboard' : (view as SlaFilter);
  const instances = instancesForFilter(data, tableFilter);

  return (
    <>
      <div className="flex h-full min-h-[calc(100vh-3rem)] bg-surface-tertiary">
        {/* Sidebar nav */}
        <nav className="w-[180px] shrink-0 bg-white border-e border-gray-200 py-3 px-2">
          {NAV.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              className={cn(
                'w-full flex items-center justify-between px-2.5 py-2 rounded-md text-sm mb-0.5',
                view === item.id
                  ? 'bg-blue-50 text-[#0B5FFF] font-medium'
                  : 'text-gray-600 hover:bg-gray-50',
              )}
            >
              {item.label}
              {badge(item.id as SlaFilter) > 0 && item.id !== 'dashboard' && (
                <span
                  className={cn(
                    'min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold flex items-center justify-center text-white',
                    item.id === 'breached'
                      ? 'bg-red-500'
                      : item.id === 'at_risk'
                        ? 'bg-amber-500'
                        : 'bg-gray-400',
                  )}
                >
                  {badge(item.id as SlaFilter)}
                </span>
              )}
            </button>
          ))}

          <div className="my-2 border-t border-gray-100" />

          <button
            type="button"
            onClick={() => setView('policies')}
            className={cn(
              'w-full text-start px-2.5 py-2 rounded-md text-sm',
              view === 'policies'
                ? 'bg-blue-50 text-[#0B5FFF] font-medium'
                : 'text-gray-600 hover:bg-gray-50',
            )}
          >
            Policies
          </button>
          <button
            type="button"
            onClick={() => setView('hours')}
            className={cn(
              'w-full text-start px-2.5 py-2 rounded-md text-sm',
              view === 'hours'
                ? 'bg-blue-50 text-[#0B5FFF] font-medium'
                : 'text-gray-600 hover:bg-gray-50',
            )}
          >
            Business hours
          </button>
        </nav>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-w-0">
          {isError && view !== 'policies' && view !== 'hours' && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Could not load SLA dashboard</p>
                <p className="text-xs mt-0.5 text-amber-800">
                  {(error as Error)?.message ?? 'Check gateway JWT and SLA service.'}
                </p>
                <button type="button" onClick={() => refetch()} className="text-xs underline mt-1">
                  Retry
                </button>
              </div>
            </div>
          )}

          {view === 'policies' && (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700">SLA Policies</h2>
                <Button size="sm" onClick={() => setNewPolicyOpen(true)}>
                  <PlusCircle className="w-4 h-4 mr-1.5" />
                  New policy
                </Button>
              </div>
              <div className="grid md:grid-cols-3 gap-3">
                {policies.map(p => (
                  <PolicyCard key={p.id} policy={p} />
                ))}
                {policies.length === 0 && (
                  <div className="col-span-3 py-12 text-center text-sm text-muted-foreground">
                    No policies yet. Click <strong>New policy</strong> to create one.
                  </div>
                )}
              </div>
            </>
          )}

          {view === 'hours' && <SlaCalendarsSection />}

          {view !== 'policies' && view !== 'hours' && (
            <>
              <SLAKPICards stats={stats} />
              <SLAInstanceTable instances={instances} isLoading={isLoading} />
            </>
          )}
        </div>
      </div>

      {/* New policy modal — rendered outside the scrollable area */}
      <PolicyFormModal open={newPolicyOpen} onClose={() => setNewPolicyOpen(false)} />
    </>
  );
}

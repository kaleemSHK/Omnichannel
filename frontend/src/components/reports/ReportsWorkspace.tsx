'use client';

import { useState } from 'react';
import { BarChart2, Bot, BrainCircuit, Inbox, MessageSquare, Phone, ShieldOff, Users, Users2 } from 'lucide-react';
import { OverviewReport } from '@/components/reports/OverviewReport';
import { AgentReport } from '@/components/reports/AgentReport';
import { InboxReport } from '@/components/reports/InboxReport';
import { TeamReport } from '@/components/reports/TeamReport';
import { AnalyticsDashboard } from '@/components/reports/AnalyticsDashboard';
import { VoicebotAnalyticsPanel } from '@/components/reports/VoicebotAnalyticsPanel';
import { CallingReport } from '@/components/reports/CallingReport';
import { SurveyWorkspace } from '@/components/surveys/SurveyWorkspace';
import { can } from '@/lib/rbac';
import { useAuthStore } from '@/lib/store/auth';
import { cn } from '@/lib/utils/cn';

const NAV = [
  { id: 'overview',   label: 'Overview',         icon: BarChart2,    group: 'Conversations' },
  { id: 'analytics',  label: 'Analytics',         icon: BrainCircuit, group: 'Conversations' },
  { id: 'voicebot',   label: 'Voicebot',          icon: Bot,          group: 'Conversations' },
  { id: 'agents',     label: 'Agent reports',     icon: Users,        group: 'Conversations' },
  { id: 'inboxes',    label: 'Inbox reports',     icon: Inbox,        group: 'Conversations' },
  { id: 'teams',      label: 'Team reports',      icon: Users2,       group: 'Conversations' },
  { id: 'calling',    label: 'Calling',           icon: Phone,        group: 'Voice' },
  { id: 'surveys',    label: 'Surveys',           icon: MessageSquare, group: 'Other' },
] as const;

type ReportView = (typeof NAV)[number]['id'];

export function ReportsWorkspace() {
  const [view, setView] = useState<ReportView>('overview');
  const role = useAuthStore(s => s.user?.role);

  if (!can(role, 'viewReports')) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <ShieldOff size={40} className="opacity-40" />
        <p className="text-sm">You don&apos;t have permission to view reports.</p>
      </div>
    );
  }

  function renderView() {
    switch (view) {
      case 'overview':   return <OverviewReport />;
      case 'analytics':  return <AnalyticsDashboard />;
      case 'voicebot':   return <VoicebotAnalyticsPanel />;
      case 'agents':     return <AgentReport />;
      case 'inboxes':    return <InboxReport />;
      case 'teams':      return <TeamReport />;
      case 'calling':    return <CallingReport />;
      case 'surveys':    return <SurveyWorkspace />;
    }
  }

  // Group nav items by group
  const groups = NAV.reduce<Record<string, typeof NAV[number][]>>((acc, item) => {
    (acc[item.group] ??= []).push(item);
    return acc;
  }, {});

  return (
    <div className="flex h-full min-h-[calc(100vh-3rem)] overflow-hidden">
      <nav className="w-[200px] shrink-0 border-e bg-muted/20 py-4 px-2 overflow-y-auto" aria-label="Report sections">
        {Object.entries(groups).map(([group, items]) => (
          <div key={group} className="mb-4">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1.5">
              {group}
            </p>
            {items.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                aria-current={view === id ? 'page' : undefined}
                onClick={() => setView(id)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm mb-0.5 text-start transition-colors',
                  view === id
                    ? 'bg-blue-50 text-brand-primary font-medium'
                    : 'text-muted-foreground hover:bg-muted',
                )}
              >
                <Icon size={15} aria-hidden />
                {label}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="flex-1 overflow-y-auto min-w-0">{renderView()}</div>
    </div>
  );
}

'use client';

import { cn } from '@/lib/utils/cn';
import { teamLabel } from '@/lib/demo/ticketsFixture';
import type { TicketNavView, TicketTeam } from '@/lib/utils/tickets';

interface Props {
  navView: TicketNavView;
  team: TicketTeam | null;
  openCount: number;
  highCount: number;
  onNavChange: (view: TicketNavView) => void;
  onTeamChange: (team: TicketTeam | null) => void;
}

const VIEWS: { id: TicketNavView; label: string; badge?: 'open' | 'high' }[] = [
  { id: 'all_open', label: 'All open', badge: 'open' },
  { id: 'high_priority', label: 'High priority', badge: 'high' },
  { id: 'assigned_to_me', label: 'Assigned to me' },
  { id: 'resolved', label: 'Resolved' },
];

const TEAMS: TicketTeam[] = ['sales', 'support', 'billing'];

export function TicketNav({
  navView,
  team,
  openCount,
  highCount,
  onNavChange,
  onTeamChange,
}: Props) {
  return (
    <aside className="w-[190px] shrink-0 border-e border-gray-200 bg-white flex flex-col">
      <div className="px-3 py-2.5 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Views</p>
      </div>
      <nav className="py-1">
        {VIEWS.map(v => (
          <button
            key={v.id}
            type="button"
            onClick={() => onNavChange(v.id)}
            className={cn(
              'w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-start',
              navView === v.id ? 'bg-blue-50 text-[#0B5FFF] font-medium' : 'text-gray-700 hover:bg-gray-50',
            )}
          >
            <span>{v.label}</span>
            {v.badge === 'open' && openCount > 0 && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 tabular-nums">
                {openCount}
              </span>
            )}
            {v.badge === 'high' && highCount > 0 && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 tabular-nums">
                {highCount}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="px-3 py-2 border-t border-gray-100 mt-1">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Teams</p>
      </div>
      <nav className="py-1 pb-3">
        <button
          type="button"
          onClick={() => onTeamChange(null)}
          className={cn(
            'w-full px-3 py-2 text-sm text-start',
            team === null ? 'bg-blue-50 text-[#0B5FFF] font-medium' : 'text-gray-700 hover:bg-gray-50',
          )}
        >
          All teams
        </button>
        {TEAMS.map(t => (
          <button
            key={t}
            type="button"
            onClick={() => onTeamChange(t)}
            className={cn(
              'w-full px-3 py-2 text-sm text-start',
              team === t ? 'bg-blue-50 text-[#0B5FFF] font-medium' : 'text-gray-700 hover:bg-gray-50',
            )}
          >
            {teamLabel(t)}
          </button>
        ))}
      </nav>
    </aside>
  );
}

'use client';

import { useMentionableAgents, type MentionableAgent } from '@/lib/hooks/useChatwootExtras';

interface Props {
  query: string;
  onSelect: (agent: MentionableAgent) => void;
  onClose: () => void;
}

export function AgentMentionPicker({ query, onSelect, onClose }: Props) {
  const { data: agents = [], isLoading, isFetching } = useMentionableAgents(query);

  if (isLoading || isFetching) {
    return (
      <div className="absolute bottom-full left-0 w-full mb-1 bg-white border rounded-lg shadow-lg z-50 px-3 py-2 text-xs text-muted-foreground">
        Loading agents…
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <PickerShell>
        <p className="px-3 py-2 text-xs text-muted-foreground">
          {query.trim() ? `No agents matching "@${query}"` : 'Type a name after @ to mention an agent'}
        </p>
      </PickerShell>
    );
  }

  return (
    <PickerShell>
      {agents.map(agent => (
        <button
          key={agent.id}
          type="button"
          onMouseDown={e => e.preventDefault()}
          onClick={() => {
            onSelect(agent);
            onClose();
          }}
          className="w-full text-start px-3 py-2 hover:bg-muted flex gap-3 items-center"
        >
          <span className="w-7 h-7 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold flex items-center justify-center shrink-0">
            {agent.name.slice(0, 2).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-sm font-medium block truncate">{agent.name}</span>
            <span className="text-xs text-muted-foreground truncate">{agent.email}</span>
          </span>
        </button>
      ))}
    </PickerShell>
  );
}

function PickerShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute bottom-full left-0 w-full mb-1 bg-white border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
      {children}
    </div>
  );
}

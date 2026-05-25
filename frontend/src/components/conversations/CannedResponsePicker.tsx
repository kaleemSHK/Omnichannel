'use client';

import { useCannedResponses } from '@/lib/hooks/useChatwootExtras';

interface Props {
  query: string;
  onSelect: (text: string) => void;
  onClose: () => void;
}

export function CannedResponsePicker({ query, onSelect, onClose }: Props) {
  const { data = [], isLoading, isFetching } = useCannedResponses(query);

  if (isLoading || isFetching) {
    return (
      <div className="absolute bottom-full left-0 w-full mb-1 bg-white border rounded-lg shadow-lg z-50 px-3 py-2 text-xs text-muted-foreground">
        Loading canned responses…
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="absolute bottom-full left-0 w-full mb-1 bg-white border rounded-lg shadow-lg z-50 px-3 py-2 text-xs text-muted-foreground">
        {query.trim()
          ? `No canned responses matching "/${query}"`
          : 'Type a short code after / (e.g. /greet)'}
      </div>
    );
  }

  return (
    <div className="absolute bottom-full left-0 w-full mb-1 bg-white border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
      {data.map(cr => (
        <button
          key={cr.id}
          type="button"
          onMouseDown={e => e.preventDefault()}
          onClick={() => {
            onSelect(cr.content);
            onClose();
          }}
          className="w-full text-start px-3 py-2 hover:bg-muted flex gap-3 items-start"
        >
          <code className="text-xs bg-blue-50 text-brand-primary px-1.5 py-0.5 rounded shrink-0 mt-0.5">
            /{cr.short_code}
          </code>
          <span className="text-sm text-muted-foreground line-clamp-2">{cr.content}</span>
        </button>
      ))}
    </div>
  );
}

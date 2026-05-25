import { useEffect, useState } from 'react';
import { relativeTime } from '@/lib/utils/conversations';

export function useLiveRelativeTime(ts: number | string): string {
  const [label, setLabel] = useState(() => relativeTime(ts));
  useEffect(() => {
    setLabel(relativeTime(ts));
    const id = setInterval(() => setLabel(relativeTime(ts)), 60_000);
    return () => clearInterval(id);
  }, [ts]);
  return label;
}

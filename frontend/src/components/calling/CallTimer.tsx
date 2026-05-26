'use client';

import { useEffect, useState } from 'react';

interface Props {
  startTime: string;
  className?: string;
}

export function CallTimer({ startTime, className }: Props) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(startTime).getTime();
    if (isNaN(start)) return;

    setElapsed(Math.floor((Date.now() - start) / 1000));
    const id = setInterval(
      () => setElapsed(Math.floor((Date.now() - start) / 1000)),
      1000,
    );
    return () => clearInterval(id);
  }, [startTime]);

  const hh = Math.floor(elapsed / 3600);
  const mm = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  const display = hh > 0 ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`;

  return (
    <time
      className={className}
      dateTime={`PT${elapsed}S`}
      aria-label={`Call duration ${hh > 0 ? `${hh} hours ` : ''}${Number(mm)} minutes ${Number(ss)} seconds`}
    >
      {display}
    </time>
  );
}

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

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  return (
    <time
      className={className}
      dateTime={`PT${elapsed}S`}
      aria-label={`Call duration ${mm} minutes ${Number(ss)} seconds`}
    >
      {mm}:{ss}
    </time>
  );
}

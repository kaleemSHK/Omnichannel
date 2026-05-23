'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';

interface PopoverContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PopoverContext = React.createContext<PopoverContextValue | null>(null);

export function Popover({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, onOpenChange]);

  return (
    <PopoverContext.Provider value={{ open, onOpenChange }}>
      <div ref={ref} className="relative inline-block">
        {children}
      </div>
    </PopoverContext.Provider>
  );
}

export function PopoverTrigger({
  children,
  asChild,
}: {
  children: React.ReactNode;
  asChild?: boolean;
}) {
  const ctx = React.useContext(PopoverContext);
  if (!ctx) return <>{children}</>;

  const toggle = () => ctx.onOpenChange(!ctx.open);

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick?: () => void }>, {
      onClick: toggle,
    });
  }

  return (
    <button type="button" onClick={toggle}>
      {children}
    </button>
  );
}

export function PopoverContent({
  className,
  children,
  align = 'start',
}: {
  className?: string;
  children: React.ReactNode;
  align?: 'start' | 'end';
}) {
  const ctx = React.useContext(PopoverContext);
  if (!ctx?.open) return null;

  return (
    <div
      className={cn(
        'absolute z-50 mt-1 min-w-[8rem] rounded-md border border-gray-200 bg-white p-1 shadow-md',
        align === 'end' ? 'end-0' : 'start-0',
        className,
      )}
    >
      {children}
    </div>
  );
}

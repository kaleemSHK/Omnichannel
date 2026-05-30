'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { History, LayoutGrid, Phone, Workflow } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const TABS = [
  { href: '/calling', label: 'Workspace', icon: Phone, exact: true },
  { href: '/calling/history', label: 'History', icon: History },
  { href: '/calling/wallboard', label: 'Wallboard', icon: LayoutGrid },
  { href: '/calling/ivr', label: 'IVR flows', icon: Workflow },
];

export default function CallingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full min-h-0">
      <nav className="flex items-center gap-1 px-3 h-11 border-b border-white/10 bg-slate-950 shrink-0">
        {TABS.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-sky-500/20 text-sky-300'
                  : 'text-slate-500 hover:text-slate-200 hover:bg-white/5',
              )}
            >
              <Icon size={15} aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

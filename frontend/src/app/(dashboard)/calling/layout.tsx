'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { History, LayoutGrid, Phone, Workflow } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth';
import { canAccessRoute } from '@/lib/rbac';
import { cn } from '@/lib/utils/cn';

const TABS = [
  { href: '/calling', label: 'Workspace', icon: Phone, route: '/calling' },
  { href: '/calling/history', label: 'History', icon: History, route: '/calling/history' },
  { href: '/calling/wallboard', label: 'Wallboard', icon: LayoutGrid, route: '/calling/wallboard' },
  { href: '/calling/ivr', label: 'IVR flows', icon: Workflow, route: '/calling/ivr' },
];

export default function CallingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const role = useAuthStore(s => s.user?.role);

  const visibleTabs = TABS.filter(tab => canAccessRoute(role, tab.route));

  return (
    <div className="flex flex-col h-full min-h-0">
      <nav
        className="flex items-center gap-1 px-4 h-11 border-b border-gray-200 bg-white shrink-0 overflow-x-auto"
        aria-label="Calling sections"
      >
        {visibleTabs.map(({ href, label, icon: Icon, route }) => {
          const active =
            route === '/calling' ? pathname === '/calling' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
                active
                  ? 'bg-brand-primary/10 text-brand-primary'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50',
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

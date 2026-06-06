'use client';

import { useAuthStore } from '@/lib/store/auth';
import { useRouter, usePathname } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { ROLE_META, type UserRole } from '@/lib/rbac';
import { cn } from '@/lib/utils/cn';
import { disconnectCable } from '@/lib/api/websocket';
import { markAgentOffline } from '@/lib/store/availability';
import { AvailabilitySelector } from '@/components/layout/AvailabilitySelector';

const PAGE_TITLES: Record<string, string> = {
  '/conversations': 'Conversations',
  '/calling': 'Calling',
  '/contacts': 'Contacts',
  '/sla': 'SLA Dashboard',
  '/escalation': 'Escalation Rules',
  '/ai': 'AI Knowledge',
  '/billing': 'Billing & Usage',
  '/platform': 'Platform Admin',
  '/tickets': 'Tickets',
  '/reports': 'Reports',
  '/settings': 'Settings',
};

export function TopBar() {
  const { user, clearAuth } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  const pageTitle =
    Object.entries(PAGE_TITLES)
      .filter(([route]) => pathname.startsWith(route))
      .sort((a, b) => b[0].length - a[0].length)[0]?.[1] ?? 'BlinkOne';

  const roleMeta = user?.role ? ROLE_META[user.role as UserRole] : null;

  function handleLogout() {
    void (async () => {
      try {
        await markAgentOffline();
        disconnectCable();
      } catch {
        /* non-fatal */
      }
      clearAuth();
      router.push('/login');
    })();
  }

  return (
    <header className="h-12 shrink-0 border-b border-gray-100 bg-white flex items-center justify-between px-4 gap-4">
      <h1 className="text-sm font-semibold text-gray-900 truncate">{pageTitle}</h1>

      <div className="flex items-center gap-2 shrink-0">
        <AvailabilitySelector />
        {roleMeta && (
          <span
            className={cn(
              'text-xs px-2 py-0.5 rounded-full font-medium hidden sm:inline',
              roleMeta.color,
            )}
          >
            {roleMeta.label}
          </span>
        )}
        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold flex items-center justify-center">
          {user?.name?.slice(0, 2).toUpperCase() ?? '?'}
        </div>
        <span className="text-sm text-gray-600 hidden md:inline">{user?.name}</span>
        <button
          type="button"
          onClick={handleLogout}
          className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 transition-colors"
          title="Sign out"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}

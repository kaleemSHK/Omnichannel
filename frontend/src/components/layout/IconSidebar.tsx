'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart2,
  Bot,
  Building2,
  Clock,
  MessageSquare,
  Phone,
  Receipt,
  Settings,
  Ticket,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAuthStore } from '@/lib/store/auth';
import { canAccessRoute } from '@/lib/rbac';
import { cn } from '@/lib/utils/cn';

const navItems = [
  { icon: MessageSquare, label: 'Conversations', href: '/conversations' },
  { icon: Phone, label: 'Calling', href: '/calling' },
  { icon: Users, label: 'Contacts', href: '/contacts' },
  { icon: Clock, label: 'SLA', href: '/sla' },
  { icon: TrendingUp, label: 'Escalation', href: '/escalation' },
  { icon: Bot, label: 'AI Assist', href: '/ai' },
  { icon: BarChart2, label: 'Reports', href: '/reports' },
  { icon: Receipt, label: 'Billing', href: '/billing' },
  { icon: Ticket, label: 'Tickets', href: '/tickets' },
  { icon: Settings, label: 'Settings', href: '/settings' },
];

export function IconSidebar() {
  const pathname = usePathname();
  const role = useAuthStore(s => s.user?.role);

  const visibleNavItems = navItems.filter(item => canAccessRoute(role, item.href));
  const showPlatform = canAccessRoute(role, '/platform');

  return (
    <TooltipProvider delayDuration={200}>
      <aside className="w-[52px] h-screen bg-white border-r border-gray-100 flex flex-col items-center py-3 gap-1 z-20 shrink-0">
        <Link
          href="/conversations"
          className="w-9 h-9 flex items-center justify-center mb-1 rounded-lg"
        >
          <div className="w-7 h-7 rounded-md bg-brand-primary flex items-center justify-center">
            <span className="text-white text-xs font-bold">B1</span>
          </div>
        </Link>

        {visibleNavItems.map(({ icon: Icon, label, href }) => {
          const active = pathname.startsWith(href);
          return (
            <Tooltip key={href}>
              <TooltipTrigger asChild>
                <Link
                  href={href}
                  className={cn(
                    'w-9 h-9 rounded-lg flex items-center justify-center transition-colors',
                    active
                      ? 'bg-blue-50 text-brand-primary'
                      : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  <Icon size={18} />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">{label}</TooltipContent>
            </Tooltip>
          );
        })}

        <div className="flex-1" />

        {showPlatform && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/platform"
                className={cn(
                  'w-9 h-9 rounded-lg flex items-center justify-center transition-colors',
                  pathname.startsWith('/platform')
                    ? 'bg-blue-50 text-brand-primary'
                    : 'text-muted-foreground hover:bg-muted',
                )}
              >
                <Building2 size={18} />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">Platform</TooltipContent>
          </Tooltip>
        )}
      </aside>
    </TooltipProvider>
  );
}

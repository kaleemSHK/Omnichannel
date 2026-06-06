'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { IconSidebar } from '@/components/layout/IconSidebar';
import { TopBar } from '@/components/layout/TopBar';
import { RoleGuard } from '@/components/layout/RoleGuard';
import { ActiveCallBar } from '@/components/calling/ActiveCallBar';
import { PhonePanel } from '@/components/calling/PhonePanel';
import { SipInitializer } from '@/components/calling/SipInitializer';
import { SipAudioHost } from '@/components/calling/SipAudioHost';
import { AgentPresenceInitializer } from '@/components/layout/AgentPresenceInitializer';
import { cn } from '@/lib/utils/cn';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Resume AudioContext on first user interaction so ringtone can play
  useEffect(() => {
    const resume = () => {
      if (typeof window !== 'undefined') {
        const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume().catch(() => undefined);
        ctx.close().catch(() => undefined);
      }
      document.removeEventListener('click', resume);
      document.removeEventListener('keydown', resume);
    };
    document.addEventListener('click', resume, { once: true });
    document.addEventListener('keydown', resume, { once: true });
    return () => {
      document.removeEventListener('click', resume);
      document.removeEventListener('keydown', resume);
    };
  }, []);
  const isCallingRoute = pathname.startsWith('/calling');

  return (
    <RoleGuard>
      <AgentPresenceInitializer />
      <SipInitializer />
      <SipAudioHost />
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <IconSidebar />
        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          <TopBar />
          <main className="flex flex-1 flex-col overflow-hidden min-h-0">
            <ActiveCallBar />
            <div
              className={cn(
                'flex-1 min-h-0',
                isCallingRoute ? 'overflow-hidden' : 'overflow-auto',
              )}
            >
              {children}
            </div>
          </main>
        </div>
        <PhonePanel />
      </div>
    </RoleGuard>
  );
}

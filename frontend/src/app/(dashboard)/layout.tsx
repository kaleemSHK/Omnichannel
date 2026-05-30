'use client';

import { usePathname } from 'next/navigation';
import { IconSidebar } from '@/components/layout/IconSidebar';
import { TopBar } from '@/components/layout/TopBar';
import { RoleGuard } from '@/components/layout/RoleGuard';
import { ActiveCallBar } from '@/components/calling/ActiveCallBar';
import { FloatingMiniCall } from '@/components/calling/workspace/FloatingMiniCall';
import { PhonePanel } from '@/components/calling/PhonePanel';
import { SipInitializer } from '@/components/calling/SipInitializer';
import { SipAudioHost } from '@/components/calling/SipAudioHost';
import { cn } from '@/lib/utils/cn';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isCallingRoute = pathname.startsWith('/calling');

  return (
    <RoleGuard>
      <SipInitializer />
      <SipAudioHost />
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <IconSidebar />
        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          <TopBar />
          <main className="flex flex-1 flex-col overflow-hidden min-h-0">
            {isCallingRoute ? <ActiveCallBar /> : null}
            <FloatingMiniCall />
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

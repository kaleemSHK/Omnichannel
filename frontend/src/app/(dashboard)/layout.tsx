'use client';

import { IconSidebar } from '@/components/layout/IconSidebar';
import { TopBar } from '@/components/layout/TopBar';
import { RoleGuard } from '@/components/layout/RoleGuard';
import { ActiveCallBar } from '@/components/calling/ActiveCallBar';
import { PhonePanel } from '@/components/calling/PhonePanel';
import { SipInitializer } from '@/components/calling/SipInitializer';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard>
      <SipInitializer />
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <IconSidebar />
        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          <TopBar />
          <main className="flex flex-1 flex-col overflow-hidden min-h-0">
            <ActiveCallBar />
            <div className="flex-1 overflow-auto min-h-0">{children}</div>
          </main>
        </div>
        <PhonePanel />
      </div>
    </RoleGuard>
  );
}

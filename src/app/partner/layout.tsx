import type { ReactNode } from 'react';

import { PartnerHeader } from '@/components/layout/partner-header';
import { PartnerSidebar } from '@/components/layout/partner-sidebar';

export default function PartnerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-panel">
      <PartnerSidebar />
      <div className="min-w-0 flex-1">
        <PartnerHeader />
        <main className="mx-auto max-w-[1440px] px-4 py-8 md:px-6 lg:px-9 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}

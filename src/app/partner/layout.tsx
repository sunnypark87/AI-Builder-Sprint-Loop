import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';

import { PartnerHeader } from '@/components/layout/partner-header';
import { PartnerSidebar } from '@/components/layout/partner-sidebar';
import { getCurrentUser } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

export default async function PartnerLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/partner');
  const supabase = await createClient();
  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership) redirect('/account');

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

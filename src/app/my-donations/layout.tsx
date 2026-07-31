import type { ReactNode } from 'react';

import { requireCurrentUser } from '@/lib/supabase/auth';

export default async function MyDonationsLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireCurrentUser('/my-donations');
  return children;
}

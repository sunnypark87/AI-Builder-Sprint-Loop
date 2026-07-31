import type { ReactNode } from 'react';

import { requireCurrentUser } from '@/lib/supabase/auth';

export default async function AccountLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireCurrentUser('/account');
  return children;
}

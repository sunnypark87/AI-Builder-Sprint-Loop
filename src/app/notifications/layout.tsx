import type { ReactNode } from 'react';

import { requireCurrentUser } from '@/lib/supabase/auth';

export default async function NotificationsLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireCurrentUser('/notifications');
  return children;
}

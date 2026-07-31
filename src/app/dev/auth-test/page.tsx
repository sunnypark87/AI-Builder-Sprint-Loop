import { notFound } from 'next/navigation';

import { AuthTestPanel } from './auth-test-panel';

export default function AuthTestPage() {
  if (process.env.NODE_ENV !== 'development') {
    notFound();
  }

  return <AuthTestPanel />;
}

'use client';

import { RefreshCwIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { buttonClassName } from '@/components/ui/button';

export function ReportRetryButton({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  return (
    <div className="grid justify-items-start gap-2">
      <button
        className={buttonClassName({ variant: 'secondary' })}
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError('');
          try {
            const response = await fetch(
              `/api/partner/reports/${reportId}/retry`,
              {
                method: 'POST',
              },
            );
            const result = (await response.json()) as {
              error?: { message?: string };
            };
            if (!response.ok) {
              setError(result.error?.message ?? '다시 생성할 수 없습니다.');
              return;
            }
            router.refresh();
          } catch {
            setError('서버에 연결할 수 없습니다.');
          } finally {
            setPending(false);
          }
        }}
        type="button"
      >
        <RefreshCwIcon
          aria-hidden="true"
          className={pending ? 'size-4 animate-spin' : 'size-4'}
        />
        {pending ? '다시 생성 중' : '초안 다시 생성'}
      </button>
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

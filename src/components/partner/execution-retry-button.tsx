'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function ExecutionRetryButton({ executionId }: { executionId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  return (
    <div className="mt-2 text-xs">
      <button
        className="underline underline-offset-4 disabled:opacity-50"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError('');
          try {
            const response = await fetch(
              `/api/partner/executions/${executionId}`,
              {
                method: 'POST',
              },
            );
            const result = (await response.json()) as {
              status?: string;
              error?: { message?: string };
            };
            if (!response.ok) {
              setError(result.error?.message ?? '재분석할 수 없습니다.');
              return;
            }
            if (
              result.status === 'review_required' ||
              result.status === 'verification_warning'
            ) {
              router.push(`/partner/executions/${executionId}/review`);
            } else {
              router.refresh();
            }
          } catch {
            setError('서버에 연결할 수 없습니다.');
          } finally {
            setPending(false);
          }
        }}
        type="button"
      >
        {pending ? '재분석 중' : '재분석'}
      </button>
      {error ? <p className="mt-1 text-danger">{error}</p> : null}
    </div>
  );
}

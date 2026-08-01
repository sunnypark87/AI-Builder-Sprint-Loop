'use client';

import { LoaderCircleIcon, RefreshCwIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { buttonClassName } from '@/components/ui/button';

export function PlanRetryButton({ planId }: { planId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  return (
    <div className="mt-2 grid gap-1">
      <button
        className={buttonClassName({ size: 'small', variant: 'secondary' })}
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError('');
          try {
            const response = await fetch(`/api/partner/plans/${planId}`, {
              method: 'POST',
            });
            const result = (await response.json()) as {
              planId?: string;
              error?: { message?: string };
            };
            if (!response.ok || !result.planId) {
              setError(result.error?.message ?? '재분석할 수 없습니다.');
              return;
            }
            router.push(`/partner/plans/${result.planId}/review`);
            router.refresh();
          } catch {
            setError('서버에 연결할 수 없습니다.');
          } finally {
            setPending(false);
          }
        }}
        type="button"
      >
        {pending ? (
          <LoaderCircleIcon
            aria-hidden="true"
            className="size-4 animate-spin"
          />
        ) : (
          <RefreshCwIcon aria-hidden="true" className="size-4" />
        )}
        {pending ? '재분석 중' : '재시도'}
      </button>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}

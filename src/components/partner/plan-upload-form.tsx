'use client';

import { LoaderCircleIcon, UploadIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { buttonClassName } from '@/components/ui/button';
import { InlineNotice } from '@/components/ui/inline-notice';

export type EligibleDonation = {
  id: string;
  organizationId: string;
  label: string;
};

type ApiError = {
  error?: {
    message?: string;
  };
};

export function PlanUploadForm({
  donations,
}: {
  donations: EligibleDonation[];
}) {
  const router = useRouter();
  const submitting = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  return (
    <form
      className="mt-8 grid max-w-[720px] gap-8"
      onSubmit={async (event) => {
        event.preventDefault();
        if (submitting.current) {
          return;
        }

        const form = event.currentTarget;
        const formData = new FormData(form);
        const donationId = String(formData.get('donationId') ?? '');
        const donation = donations.find((item) => item.id === donationId);
        if (!donation) {
          setError('대상 기부 내역을 선택해 주세요.');
          return;
        }

        submitting.current = true;
        setPending(true);
        setError('');
        formData.set('organizationId', donation.organizationId);
        formData.set('idempotencyKey', `plan:${crypto.randomUUID()}`);

        try {
          const response = await fetch('/api/partner/plans', {
            method: 'POST',
            body: formData,
          });
          const result = (await response.json()) as ApiError & {
            planId?: string;
            status?: string;
          };

          if (!response.ok || !result.planId) {
            setError(
              result.error?.message ?? '집행 계획서를 분석할 수 없습니다.',
            );
            return;
          }

          if (result.status === 'review_required') {
            router.push(`/partner/plans/${result.planId}/review`);
            return;
          }

          router.push('/partner/plans?status=analyzing');
        } catch {
          setError('서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.');
        } finally {
          submitting.current = false;
          setPending(false);
        }
      }}
    >
      {donations.length === 0 ? (
        <InlineNotice title="등록 가능한 기부 내역이 없습니다.">
          기부 약정과 결제가 완료된 내역을 먼저 확인해 주세요.
        </InlineNotice>
      ) : null}

      <label className="grid gap-1.5 text-sm font-medium">
        대상 기부 내역
        <select
          className="h-10 w-full rounded-[var(--radius-sm)] border border-line bg-panel px-3 text-sm text-copy hover:border-copy-disabled"
          disabled={pending || donations.length === 0}
          name="donationId"
          required
        >
          <option value="">기부 내역 선택</option>
          {donations.map((donation) => (
            <option key={donation.id} value={donation.id}>
              {donation.label}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1.5 text-sm font-medium">
        집행 계획서
        <input
          accept=".pdf,.png,.jpg,.jpeg"
          className="min-h-12 rounded-[var(--radius-sm)] border border-dashed border-line px-3 py-2 text-sm file:mr-3 file:border-0 file:bg-panel-muted file:px-3 file:py-1.5 file:text-sm"
          disabled={pending || donations.length === 0}
          name="document"
          required
          type="file"
        />
        <span className="text-xs font-normal text-copy-muted">
          PDF, PNG, JPG · 최대 10MB · PDF 최대 30페이지
        </span>
      </label>

      {error ? (
        <InlineNotice title="계획서를 등록하지 못했습니다." tone="danger">
          {error}
        </InlineNotice>
      ) : null}

      <div className="flex justify-end border-t border-line pt-6">
        <button
          className={buttonClassName({ size: 'large' })}
          disabled={pending || donations.length === 0}
          type="submit"
        >
          {pending ? (
            <LoaderCircleIcon
              aria-hidden="true"
              className="size-4 animate-spin"
            />
          ) : (
            <UploadIcon aria-hidden="true" className="size-4" />
          )}
          {pending ? '계획서 분석 중' : '계획서 분석'}
        </button>
      </div>
    </form>
  );
}

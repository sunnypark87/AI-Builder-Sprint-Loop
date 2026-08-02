'use client';

import { LoaderCircleIcon, UploadIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { buttonClassName } from '@/components/ui/button';
import { InlineNotice } from '@/components/ui/inline-notice';
import { RECEIPT_DOCUMENT_BUCKET } from '@/lib/executions/execution-repository';
import { createClient } from '@/lib/supabase/client';

export type ExecutionUploadOption = {
  organizationId: string;
  donationId: string;
  planId: string;
  planTitle: string;
  planItemId: string;
  planItemName: string;
  remainingBudget: number;
};

type ApiError = {
  executionId?: string;
  error?: { message?: string; retryable?: boolean };
};

async function cleanup(sourcePath: string) {
  try {
    await fetch('/api/partner/executions/upload-url', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourcePath }),
    });
  } catch {
    // Server storage lifecycle remains the fallback.
  }
}

export function ExecutionUploadForm({
  options,
}: {
  options: ExecutionUploadOption[];
}) {
  const router = useRouter();
  const submitting = useRef(false);
  const idempotencyKey = useRef<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  return (
    <form
      className="mt-8 grid max-w-[720px] gap-8"
      onSubmit={async (event) => {
        event.preventDefault();
        if (submitting.current) return;
        const form = event.currentTarget;
        const selectedId = String(new FormData(form).get('planItemId') ?? '');
        const selected = options.find((item) => item.planItemId === selectedId);
        const input = form.elements.namedItem(
          'receipt',
        ) as HTMLInputElement | null;
        const file = input?.files?.[0];
        if (!selected || !file) {
          setError('계획 예산 항목과 영수증을 확인해 주세요.');
          return;
        }
        submitting.current = true;
        setPending(true);
        setError('');
        idempotencyKey.current ??= `execution:${crypto.randomUUID()}`;
        let pendingPath: string | null = null;
        let analysisStarted = false;
        try {
          const uploadResponse = await fetch(
            '/api/partner/executions/upload-url',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                organizationId: selected.organizationId,
                donationId: selected.donationId,
                planId: selected.planId,
                planItemId: selected.planItemId,
                fileName: file.name,
                mimeType: file.type,
                size: file.size,
              }),
            },
          );
          const upload = (await uploadResponse.json()) as ApiError & {
            sourcePath?: string;
            token?: string;
          };
          if (!uploadResponse.ok || !upload.sourcePath || !upload.token) {
            idempotencyKey.current = null;
            setError(
              upload.error?.message ?? '영수증 업로드를 준비할 수 없습니다.',
            );
            return;
          }
          pendingPath = upload.sourcePath;
          const { error: uploadError } = await createClient()
            .storage.from(RECEIPT_DOCUMENT_BUCKET)
            .uploadToSignedUrl(upload.sourcePath, upload.token, file, {
              contentType: file.type,
              upsert: false,
            });
          if (uploadError) {
            await cleanup(upload.sourcePath);
            pendingPath = null;
            idempotencyKey.current = null;
            setError('영수증 원본을 업로드할 수 없습니다.');
            return;
          }

          analysisStarted = true;
          const response = await fetch('/api/partner/executions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              organizationId: selected.organizationId,
              donationId: selected.donationId,
              planId: selected.planId,
              planItemId: selected.planItemId,
              idempotencyKey: idempotencyKey.current,
              sourcePath: upload.sourcePath,
              fileName: file.name,
              mimeType: file.type,
            }),
          });
          const result = (await response.json()) as ApiError & {
            status?: string;
          };
          if (result.executionId) pendingPath = null;
          if (!response.ok || !result.executionId) {
            if (pendingPath) await cleanup(pendingPath);
            if (!result.error?.retryable) idempotencyKey.current = null;
            setError(result.error?.message ?? '영수증을 분석할 수 없습니다.');
            return;
          }
          idempotencyKey.current = null;
          if (
            result.status === 'review_required' ||
            result.status === 'verification_warning'
          ) {
            router.push(`/partner/executions/${result.executionId}/review`);
          } else {
            router.push(
              `/partner/executions?status=${result.status ?? 'analyzing'}`,
            );
          }
        } catch {
          if (pendingPath && !analysisStarted) await cleanup(pendingPath);
          setError('서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.');
        } finally {
          submitting.current = false;
          setPending(false);
        }
      }}
    >
      {options.length === 0 ? (
        <InlineNotice title="등록 가능한 계획 예산 항목이 없습니다.">
          기부 결제와 집행 계획 내부 등록을 먼저 완료해 주세요.
        </InlineNotice>
      ) : null}

      <label className="grid gap-1.5 text-sm font-medium">
        계획 예산 항목
        <select
          className="h-10 rounded-[var(--radius-sm)] border border-line bg-panel px-3 text-sm"
          disabled={pending || options.length === 0}
          name="planItemId"
          onChange={() => {
            idempotencyKey.current = null;
            setError('');
          }}
          required
        >
          <option value="">계획 예산 항목 선택</option>
          {options.map((option) => (
            <option key={option.planItemId} value={option.planItemId}>
              {option.planTitle} · {option.planItemName} · 잔액{' '}
              {option.remainingBudget.toLocaleString('ko-KR')}원
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1.5 text-sm font-medium">
        영수증 원본
        <input
          accept=".pdf,.png,.jpg,.jpeg"
          className="min-h-12 rounded-[var(--radius-sm)] border border-dashed border-line px-3 py-2 text-sm file:mr-3 file:border-0 file:bg-panel-muted file:px-3 file:py-1.5 file:text-sm"
          disabled={pending || options.length === 0}
          name="receipt"
          onChange={() => {
            idempotencyKey.current = null;
            setError('');
          }}
          required
          type="file"
        />
        <span className="text-xs font-normal text-copy-muted">
          PDF, PNG, JPG · 최대 10MB · 원본은 비공개로 저장됩니다.
        </span>
      </label>

      <InlineNotice title="검증 범위를 확인해 주세요.">
        OCR과 내부 일관성 검사는 발행기관 조회나 법적 진위 보증이 아닙니다. 등록
        전 원본을 직접 확인해야 합니다.
      </InlineNotice>
      {error ? (
        <InlineNotice title="영수증을 등록하지 못했습니다." tone="danger">
          {error}
        </InlineNotice>
      ) : null}
      <div className="flex justify-end border-t border-line pt-6">
        <button
          className={buttonClassName({ size: 'large' })}
          disabled={pending || options.length === 0}
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
          {pending ? '영수증 분석 중' : '영수증 분석'}
        </button>
      </div>
    </form>
  );
}

'use client';

import { CheckIcon, LoaderCircleIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { buttonClassName } from '@/components/ui/button';
import { InlineNotice } from '@/components/ui/inline-notice';
import { Input } from '@/components/ui/input';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { validateReceiptDraft } from '@/lib/executions/receipt-schema';
import type {
  ReceiptDraft,
  ReceiptValidationIssue,
  ReceiptVerificationResult,
} from '@/lib/executions/types';

function issueFor(issues: ReceiptValidationIssue[], path: string) {
  return issues.find((issue) => issue.path === path)?.message;
}

function numberValue(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

const outcomeLabel = {
  passed: { label: '확인됨', tone: 'success' as const },
  warning: { label: '담당자 확인 필요', tone: 'warning' as const },
  blocked: { label: '등록 차단', tone: 'danger' as const },
};

export function ExecutionReviewForm({
  executionId,
  initialDraft,
  initialIssues,
  initialVerificationResults,
  initialWarningReason,
  planItemName,
  remainingBudget,
  readOnly = false,
}: {
  executionId: string;
  initialDraft: ReceiptDraft;
  initialIssues: ReceiptValidationIssue[];
  initialVerificationResults: ReceiptVerificationResult[];
  initialWarningReason: string;
  planItemName: string;
  remainingBudget: number;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(initialDraft);
  const [issues, setIssues] = useState(initialIssues);
  const [verificationResults, setVerificationResults] = useState(
    initialVerificationResults,
  );
  const [warningReason, setWarningReason] = useState(initialWarningReason);
  const [requestError, setRequestError] = useState('');
  const [pending, setPending] = useState(false);
  const hasWarning = verificationResults.some(
    (result) => result.outcome === 'warning',
  );
  const hasBlocker = verificationResults.some(
    (result) => result.outcome === 'blocked',
  );

  return (
    <form
      className="grid gap-6"
      onSubmit={async (event) => {
        event.preventDefault();
        const nextIssues = validateReceiptDraft(draft);
        setIssues(nextIssues);
        setRequestError('');
        if (nextIssues.length > 0) return;
        setPending(true);
        try {
          const response = await fetch(
            `/api/partner/executions/${executionId}`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ draft, warningReason }),
            },
          );
          const result = (await response.json()) as {
            error?: { message?: string };
            issues?: ReceiptValidationIssue[];
            verificationResults?: ReceiptVerificationResult[];
          };
          if (!response.ok) {
            setIssues(result.issues ?? []);
            if (result.verificationResults) {
              setVerificationResults(result.verificationResults);
            }
            setRequestError(
              result.error?.message ?? '집행 내역을 등록할 수 없습니다.',
            );
            return;
          }
          router.push('/partner/executions?status=registered');
          router.refresh();
        } catch {
          setRequestError(
            '서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.',
          );
        } finally {
          setPending(false);
        }
      }}
    >
      {readOnly ? (
        <InlineNotice title="내부 등록이 완료됐습니다.">
          등록된 값과 검증 근거를 읽기 전용으로 확인할 수 있습니다.
        </InlineNotice>
      ) : (
        <InlineNotice title="내부 일관성 검증 결과입니다." tone="warning">
          이 결과는 발행기관 조회나 법적 진위 보증이 아닙니다. 원본과 모든 값을
          직접 확인해 주세요.
        </InlineNotice>
      )}

      <div className="grid gap-2 border-y border-line py-4 text-sm sm:grid-cols-2">
        <p>
          <span className="text-copy-muted">계획 예산 항목</span>
          <strong className="mt-1 block">{planItemName}</strong>
        </p>
        <p>
          <span className="text-copy-muted">현재 잔액</span>
          <strong className="mt-1 block">
            {remainingBudget.toLocaleString('ko-KR')}원
          </strong>
        </p>
      </div>

      <section aria-labelledby="verification-heading" className="grid gap-3">
        <h2 className="text-base font-bold" id="verification-heading">
          규칙별 검증 근거
        </h2>
        <ul className="divide-y divide-line border-y border-line">
          {verificationResults.map((verification) => (
            <li
              className="grid gap-2 py-4 sm:grid-cols-[1fr_auto]"
              key={verification.code}
            >
              <div>
                <p className="font-medium">{verification.message}</p>
                <p className="mt-1 text-xs text-copy-muted">
                  규칙 {verification.code} v{verification.version} · 근거{' '}
                  {verification.evidence}
                </p>
              </div>
              <StatusIndicator tone={outcomeLabel[verification.outcome].tone}>
                {outcomeLabel[verification.outcome].label}
              </StatusIndicator>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          disabled={readOnly}
          error={issueFor(issues, 'merchantName')}
          label="상호명"
          maxLength={200}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              merchantName: event.target.value,
            }))
          }
          value={draft.merchantName}
        />
        <Input
          disabled={readOnly}
          error={issueFor(issues, 'businessNumber')}
          inputMode="numeric"
          label="사업자등록번호"
          maxLength={10}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              businessNumber: event.target.value
                .replace(/\D/g, '')
                .slice(0, 10),
            }))
          }
          value={draft.businessNumber}
        />
        <Input
          disabled={readOnly}
          error={issueFor(issues, 'transactionAt')}
          label="거래일시"
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              transactionAt: event.target.value,
            }))
          }
          type="datetime-local"
          value={draft.transactionAt}
        />
        <Input
          disabled={readOnly}
          label="결제수단"
          maxLength={100}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              paymentMethod: event.target.value,
            }))
          }
          value={draft.paymentMethod}
        />
        <Input
          disabled={readOnly}
          label="승인번호"
          maxLength={40}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              approvalNumber: event.target.value
                .replace(/\D/g, '')
                .slice(0, 40),
            }))
          }
          value={draft.approvalNumber}
        />
      </div>

      <fieldset className="grid gap-4 border-t border-line pt-5">
        <legend className="text-base font-bold">품목</legend>
        {draft.items.length === 0 ? (
          <p className="text-sm text-copy-muted">
            OCR에서 품목을 추출하지 못했습니다. 산술 검증 경고를 확인해 주세요.
          </p>
        ) : null}
        <div className="divide-y divide-line border-y border-line">
          {draft.items.map((item, index) => (
            <div
              className="grid gap-4 py-4 sm:grid-cols-[1fr_100px_150px]"
              key={item.id}
            >
              <Input
                disabled={readOnly}
                error={issueFor(issues, `items.${index}.name`)}
                label={`품목 ${index + 1}`}
                maxLength={200}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    items: current.items.map((candidate, candidateIndex) =>
                      candidateIndex === index
                        ? { ...candidate, name: event.target.value }
                        : candidate,
                    ),
                  }))
                }
                value={item.name}
              />
              <Input
                disabled={readOnly}
                error={issueFor(issues, `items.${index}.quantity`)}
                label="수량"
                min={1}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    items: current.items.map((candidate, candidateIndex) =>
                      candidateIndex === index
                        ? {
                            ...candidate,
                            quantity: numberValue(event.target.value),
                          }
                        : candidate,
                    ),
                  }))
                }
                type="number"
                value={item.quantity ?? ''}
              />
              <Input
                disabled={readOnly}
                error={issueFor(issues, `items.${index}.amount`)}
                label="품목 금액"
                min={0}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    items: current.items.map((candidate, candidateIndex) =>
                      candidateIndex === index
                        ? {
                            ...candidate,
                            amount: numberValue(event.target.value),
                          }
                        : candidate,
                    ),
                  }))
                }
                suffix="원"
                type="number"
                value={item.amount ?? ''}
              />
              {item.sourceText ? (
                <p className="text-xs text-copy-muted sm:col-span-3">
                  원문: {item.sourceText}
                  {item.confidence !== null
                    ? ` · OCR 신뢰도 ${Math.round(item.confidence * 100)}%`
                    : ''}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 border-t border-line pt-5 sm:grid-cols-3">
        {[
          ['공급가액', 'supplyAmount', draft.supplyAmount],
          ['부가세', 'taxAmount', draft.taxAmount],
          ['합계', 'totalAmount', draft.totalAmount],
        ].map(([label, key, value]) => (
          <Input
            disabled={readOnly}
            error={issueFor(issues, key as string)}
            key={key as string}
            label={label as string}
            min={0}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                [key as string]: numberValue(event.target.value),
              }))
            }
            suffix="원"
            type="number"
            value={(value as number | null) ?? ''}
          />
        ))}
      </div>

      {!readOnly && (hasWarning || hasBlocker) ? (
        <label className="grid gap-1.5 text-sm font-medium">
          검증 경고 확인 사유
          <textarea
            className="min-h-24 rounded-[var(--radius-sm)] border border-line bg-panel px-3 py-2 text-sm"
            maxLength={1000}
            onChange={(event) => setWarningReason(event.target.value)}
            placeholder="원본과 대조한 내용 및 경고를 수용하는 이유를 기록해 주세요."
            value={warningReason}
          />
        </label>
      ) : null}

      {requestError ? (
        <InlineNotice title="집행 내역을 등록하지 못했습니다." tone="danger">
          {requestError}
        </InlineNotice>
      ) : null}
      {!readOnly ? (
        <div className="flex justify-end border-t border-line pt-5">
          <button
            className={buttonClassName({ size: 'large' })}
            disabled={pending}
            type="submit"
          >
            {pending ? (
              <LoaderCircleIcon
                aria-hidden="true"
                className="size-4 animate-spin"
              />
            ) : (
              <CheckIcon aria-hidden="true" className="size-4" />
            )}
            {pending ? '등록 중' : '검토 완료·내부 등록'}
          </button>
        </div>
      ) : null}
    </form>
  );
}

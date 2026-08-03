'use client';

import {
  CheckIcon,
  LoaderCircleIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import type { EligibleDonation } from '@/components/partner/plan-upload-form';
import { buttonClassName } from '@/components/ui/button';
import { InlineNotice } from '@/components/ui/inline-notice';
import { Input } from '@/components/ui/input';
import { validatePlanDraft } from '@/lib/plans/plan-schema';
import type { PlanDraft, PlanValidationIssue } from '@/lib/plans/types';

function issueFor(issues: PlanValidationIssue[], path: string) {
  return issues.find((issue) => issue.path === path)?.message;
}

function numberValue(value: string) {
  if (value.trim() === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function PlanReviewForm({
  planId,
  initialDraft,
  initialDonationId,
  initialIssues,
  readOnly = false,
  donations = [],
}: {
  planId?: string;
  initialDraft: PlanDraft;
  initialDonationId?: string;
  initialIssues: PlanValidationIssue[];
  readOnly?: boolean;
  donations?: EligibleDonation[];
}) {
  const router = useRouter();
  const manualCreation = !planId;
  const manualSubmission = useRef<{ key: string; payload: string } | null>(
    null,
  );
  const [donationId, setDonationId] = useState(initialDonationId ?? '');
  const [draft, setDraft] = useState(initialDraft);
  const [issues, setIssues] = useState(initialIssues);
  const [pending, setPending] = useState(false);
  const [requestError, setRequestError] = useState('');
  const itemTotal = draft.items.reduce(
    (sum, item) => sum + (item.amount ?? 0),
    0,
  );

  return (
    <form
      className="grid gap-6"
      onSubmit={async (event) => {
        event.preventDefault();
        const validationIssues = validatePlanDraft(draft);
        setIssues(validationIssues);
        setRequestError('');
        if (validationIssues.length > 0) {
          return;
        }

        const donation = manualCreation
          ? donations.find((candidate) => candidate.id === donationId)
          : null;
        if (manualCreation && !donation) {
          setRequestError('대상 기부 내역을 선택해 주세요.');
          return;
        }

        setPending(true);
        try {
          const payload = JSON.stringify(draft);
          if (manualCreation && manualSubmission.current?.payload !== payload) {
            manualSubmission.current = {
              key: `manual-plan:${crypto.randomUUID()}`,
              payload,
            };
          }
          const response = await fetch(
            manualCreation
              ? '/api/partner/plans'
              : `/api/partner/plans/${planId}`,
            {
              method: manualCreation ? 'POST' : 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(
                manualCreation
                  ? {
                      mode: 'manual',
                      organizationId: donation?.organizationId,
                      donationId,
                      idempotencyKey: manualSubmission.current?.key,
                      draft,
                    }
                  : { draft },
              ),
            },
          );
          const result = (await response.json()) as {
            error?: { message?: string };
            issues?: PlanValidationIssue[];
          };
          if (!response.ok) {
            setIssues(result.issues ?? []);
            setRequestError(
              result.error?.message ?? '집행 계획을 등록할 수 없습니다.',
            );
            return;
          }
          router.push('/partner/plans?status=registered');
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
      {manualCreation ? (
        <label className="grid gap-1.5 text-sm font-medium">
          대상 기부 내역
          <select
            className="h-10 w-full rounded-[var(--radius-sm)] border border-line bg-panel px-3 text-sm text-copy hover:border-copy-disabled"
            disabled={pending || donations.length === 0}
            onChange={(event) => {
              setDonationId(event.target.value);
              manualSubmission.current = null;
            }}
            required
            value={donationId}
          >
            <option value="">기부 내역 선택</option>
            {donations.map((donation) => (
              <option key={donation.id} value={donation.id}>
                {donation.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {manualCreation && donations.length === 0 ? (
        <InlineNotice title="등록 가능한 기부 내역이 없습니다.">
          기부 약정과 결제가 완료된 내역을 먼저 확인해 주세요.
        </InlineNotice>
      ) : null}

      {readOnly ? (
        <InlineNotice title="내부 등록이 완료됐습니다.">
          등록된 값과 원본 계획서를 확인할 수 있습니다.
        </InlineNotice>
      ) : issues.length > 0 ? (
        <InlineNotice title="확인이 필요한 항목이 있습니다." tone="warning">
          원본과 비교해 표시된 값을 수정해 주세요.
        </InlineNotice>
      ) : manualCreation ? (
        <InlineNotice title="계획 내용을 직접 입력해 주세요.">
          계획서 파일 없이도 기간과 예산 항목을 입력해 등록할 수 있습니다.
        </InlineNotice>
      ) : (
        <InlineNotice title="OCR 추출이 완료됐습니다.">
          등록 전에 모든 값이 원본과 일치하는지 확인해 주세요.
        </InlineNotice>
      )}

      <Input
        disabled={readOnly}
        error={issueFor(issues, 'title')}
        label="계획명"
        maxLength={200}
        onChange={(event) =>
          setDraft((current) => ({
            ...current,
            title: event.target.value,
          }))
        }
        value={draft.title}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          disabled={readOnly}
          error={issueFor(issues, 'periodStart')}
          label="집행 시작일"
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              periodStart: event.target.value,
            }))
          }
          type="date"
          value={draft.periodStart}
        />
        <Input
          disabled={readOnly}
          error={issueFor(issues, 'periodEnd')}
          label="집행 종료일"
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              periodEnd: event.target.value,
            }))
          }
          type="date"
          value={draft.periodEnd}
        />
      </div>

      <fieldset className="grid gap-4 border-t border-line pt-5">
        <div className="flex items-center justify-between gap-3">
          <legend className="text-base font-bold">예산 항목</legend>
          {!readOnly ? (
            <button
              aria-label="예산 항목 추가"
              className={buttonClassName({
                size: 'small',
                variant: 'secondary',
              })}
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  items: [
                    ...current.items,
                    {
                      id: crypto.randomUUID(),
                      name: '',
                      description: '',
                      amount: null,
                      confidence: null,
                      sourceText: '',
                      sourceName: '',
                      sourceAmount: null,
                    },
                  ],
                }))
              }
              title="예산 항목 추가"
              type="button"
            >
              <PlusIcon aria-hidden="true" className="size-4" />
              항목 추가
            </button>
          ) : null}
        </div>

        {draft.items.length === 0 ? (
          <p className="text-sm text-danger">
            예산 항목을 한 개 이상 추가해 주세요.
          </p>
        ) : null}

        <div className="divide-y divide-line border-y border-line">
          {draft.items.map((item, index) => (
            <div
              className="grid gap-4 py-5 lg:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_160px_40px]"
              key={item.id}
            >
              <Input
                disabled={readOnly}
                error={issueFor(issues, `items.${index}.name`)}
                label={`항목 ${index + 1}`}
                maxLength={200}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    items: current.items.map((candidate, itemIndex) =>
                      itemIndex === index
                        ? { ...candidate, name: event.target.value }
                        : candidate,
                    ),
                  }))
                }
                value={item.name}
              />
              <Input
                disabled={readOnly}
                error={issueFor(issues, `items.${index}.description`)}
                label="설명"
                maxLength={1000}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    items: current.items.map((candidate, itemIndex) =>
                      itemIndex === index
                        ? {
                            ...candidate,
                            description: event.target.value,
                          }
                        : candidate,
                    ),
                  }))
                }
                value={item.description}
              />
              <Input
                disabled={readOnly}
                error={issueFor(issues, `items.${index}.amount`)}
                label="금액"
                min={1}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    items: current.items.map((candidate, itemIndex) =>
                      itemIndex === index
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
              {!readOnly ? (
                <button
                  aria-label={`예산 항목 ${index + 1} 삭제`}
                  className="mt-7 flex size-10 items-center justify-center rounded-[var(--radius-sm)] text-copy-muted hover:bg-danger-soft hover:text-danger"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      items: current.items.filter(
                        (_, itemIndex) => itemIndex !== index,
                      ),
                    }))
                  }
                  title="예산 항목 삭제"
                  type="button"
                >
                  <Trash2Icon aria-hidden="true" className="size-4" />
                </button>
              ) : null}
              {item.sourceText ? (
                <p className="text-xs leading-5 text-copy-muted lg:col-span-4">
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

      <div className="grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
        <div className="text-sm">
          <p className="text-copy-muted">항목 합계</p>
          <p className="mt-1 text-lg font-bold">
            {itemTotal.toLocaleString('ko-KR')}원
          </p>
        </div>
        <Input
          disabled={readOnly}
          error={issueFor(issues, 'totalAmount')}
          label="총 계획 예산"
          min={1}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              totalAmount: numberValue(event.target.value),
            }))
          }
          suffix="원"
          type="number"
          value={draft.totalAmount ?? ''}
        />
      </div>

      {requestError ? (
        <InlineNotice title="집행 계획을 등록하지 못했습니다." tone="danger">
          {requestError}
        </InlineNotice>
      ) : null}

      {!readOnly ? (
        <div className="flex justify-end border-t border-line pt-5">
          <button
            className={buttonClassName({ size: 'large' })}
            disabled={pending || (manualCreation && donations.length === 0)}
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
            {pending
              ? '등록 중'
              : manualCreation
                ? '계획 등록'
                : '검토 완료·등록'}
          </button>
        </div>
      ) : null}
    </form>
  );
}

'use client';

import { CheckIcon, LoaderCircleIcon, SaveIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { buttonClassName } from '@/components/ui/button';
import { InlineNotice } from '@/components/ui/inline-notice';
import { validateReportContent } from '@/lib/reports/report-schema';
import type {
  ReportContent,
  ReportEvidence,
  ReportValidationIssue,
} from '@/lib/reports/types';

function firstIssue(issues: ReportValidationIssue[], path: string) {
  return issues.find((issue) => issue.path === path)?.message;
}

function TextArea({
  label,
  value,
  error,
  onChange,
}: {
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold">
      {label}
      <textarea
        aria-invalid={Boolean(error)}
        className="min-h-28 rounded-[var(--radius-sm)] border border-line bg-panel px-3 py-2 text-sm font-normal leading-6"
        maxLength={1200}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
      {error ? <span className="font-normal text-danger">{error}</span> : null}
    </label>
  );
}

export function ReportReviewEditor({
  reportId,
  evidence,
  initialContent,
  initialIssues,
}: {
  reportId: string;
  evidence: ReportEvidence;
  initialContent: ReportContent;
  initialIssues: ReportValidationIssue[];
}) {
  const router = useRouter();
  const [content, setContent] = useState(initialContent);
  const [issues, setIssues] = useState(initialIssues);
  const [pending, setPending] = useState<'save' | 'publish' | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const submit = async (action: 'save' | 'publish') => {
    const nextIssues = validateReportContent(content, evidence);
    setIssues(nextIssues);
    setSaved(false);
    setError('');
    if (nextIssues.length > 0) return;
    setPending(action);
    try {
      const response = await fetch(
        action === 'save'
          ? `/api/partner/reports/${reportId}`
          : `/api/partner/reports/${reportId}/publish`,
        {
          method: action === 'save' ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        },
      );
      const result = (await response.json()) as {
        error?: { message?: string };
        issues?: ReportValidationIssue[];
      };
      if (!response.ok) {
        setIssues(result.issues ?? []);
        setError(result.error?.message ?? '보고서를 처리할 수 없습니다.');
        return;
      }
      if (action === 'publish') {
        router.push('/partner/reports?status=published');
        router.refresh();
      } else {
        setSaved(true);
        router.refresh();
      }
    } catch {
      setError('서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="grid gap-6">
      <InlineNotice title="숫자는 서버 근거와 다시 대조됩니다.">
        문장에는 아래에서 확인되는 금액·날짜·건수·집행률만 사용할 수 있으며,
        근거에 없는 수치는 저장하거나 발행할 수 없습니다.
      </InlineNotice>
      <label className="grid gap-2 text-sm font-bold">
        보고서 제목
        <input
          className="min-h-11 rounded-[var(--radius-sm)] border border-line bg-panel px-3 text-sm font-normal"
          maxLength={200}
          onChange={(event) =>
            setContent((current) => ({ ...current, title: event.target.value }))
          }
          value={content.title}
        />
        {firstIssue(issues, 'title') ? (
          <span className="font-normal text-danger">
            {firstIssue(issues, 'title')}
          </span>
        ) : null}
      </label>
      <TextArea
        error={firstIssue(issues, 'summary.text')}
        label="기부자 맞춤 요약"
        onChange={(text) =>
          setContent((current) => ({
            ...current,
            summary: { ...current.summary, text },
          }))
        }
        value={content.summary.text}
      />
      <TextArea
        error={firstIssue(issues, 'planComparison.text')}
        label="계획 대비 집행 설명"
        onChange={(text) =>
          setContent((current) => ({
            ...current,
            planComparison: { ...current.planComparison, text },
          }))
        }
        value={content.planComparison.text}
      />
      <section
        className="grid gap-4 border-y border-line py-5"
        aria-labelledby="item-report-heading"
      >
        <h2 className="font-bold" id="item-report-heading">
          항목별 집행 설명
        </h2>
        {content.items.map((item, index) => (
          <TextArea
            error={firstIssue(issues, `items.${index}.text`)}
            key={item.planItemId}
            label={item.title}
            onChange={(text) =>
              setContent((current) => ({
                ...current,
                items: current.items.map((candidate, candidateIndex) =>
                  candidateIndex === index ? { ...candidate, text } : candidate,
                ),
              }))
            }
            value={item.text}
          />
        ))}
      </section>
      <TextArea
        error={firstIssue(issues, 'outcomes.text')}
        label="성과"
        onChange={(text) =>
          setContent((current) => ({
            ...current,
            outcomes: { ...current.outcomes, text },
          }))
        }
        value={content.outcomes.text}
      />
      <TextArea
        error={firstIssue(issues, 'nextSteps.text')}
        label="향후 계획"
        onChange={(text) =>
          setContent((current) => ({
            ...current,
            nextSteps: { ...current.nextSteps, text },
          }))
        }
        value={content.nextSteps.text}
      />
      {issues.length > 0 ? (
        <InlineNotice title="발행 전에 수정이 필요합니다." tone="danger">
          {issues[0].message} 외 {Math.max(issues.length - 1, 0)}건
        </InlineNotice>
      ) : null}
      {error ? (
        <InlineNotice title="보고서를 처리하지 못했습니다." tone="danger">
          {error}
        </InlineNotice>
      ) : null}
      {saved ? (
        <p className="text-sm text-success" role="status">
          초안을 저장했습니다.
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-5">
        <button
          className={buttonClassName({ variant: 'secondary' })}
          disabled={pending !== null}
          onClick={() => void submit('save')}
          type="button"
        >
          {pending === 'save' ? (
            <LoaderCircleIcon
              aria-hidden="true"
              className="size-4 animate-spin"
            />
          ) : (
            <SaveIcon aria-hidden="true" className="size-4" />
          )}
          초안 저장
        </button>
        <button
          className={buttonClassName()}
          disabled={pending !== null}
          onClick={() => {
            if (
              globalThis.confirm(
                '검토한 보고서를 기부자에게 발행할까요? 발행 후에는 수정할 수 없습니다.',
              )
            ) {
              void submit('publish');
            }
          }}
          type="button"
        >
          {pending === 'publish' ? (
            <LoaderCircleIcon
              aria-hidden="true"
              className="size-4 animate-spin"
            />
          ) : (
            <CheckIcon aria-hidden="true" className="size-4" />
          )}
          검토 완료·발행
        </button>
      </div>
    </div>
  );
}

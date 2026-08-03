'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { PledgeChatPanel } from '@/components/pledges/pledge-chat-panel';
import { ImpactSummaryPanel } from '@/components/pledges/impact-summary-panel';
import { Button } from '@/components/ui/button';
import type { PledgeChatMessage, PledgeChatPatch } from '@/lib/pledges/chat';

export function ConsultationWorkspace({
  organizationId,
  initialMessages,
  initialPledgeId,
}: {
  organizationId: string;
  initialMessages: PledgeChatMessage[];
  initialPledgeId?: string;
}) {
  const router = useRouter();
  const [, setMessages] = useState(initialMessages);
  const [pledgeId, setPledgeId] = useState<string | null>(
    initialPledgeId ?? null,
  );
  const [draftPatch, setDraftPatch] = useState<PledgeChatPatch>(() =>
    getAppliedPatch(initialMessages),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPledge() {
    if (!pledgeId) {
      setError('상담을 먼저 시작해 약정 초안을 만들어 주세요.');
      return;
    }
    setLoading(true);
    setError(null);
    router.push(`/pledges/${pledgeId}/review`);
  }

  async function ensurePledge() {
    if (pledgeId) return pledgeId;
    const response = await fetch('/api/pledges', {
      body: JSON.stringify({ organizationSlug: organizationId }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
    if (response.status === 401) {
      router.push(`/login?next=/donate/${organizationId}/consultation`);
      return null;
    }
    if (!response.ok) throw new Error('pledge_create_failed');
    const result = (await response.json()) as { pledgeId: string };
    setPledgeId(result.pledgeId);
    const searchParams = new URLSearchParams(window.location.search);
    searchParams.set('pledgeId', result.pledgeId);
    router.replace(`${window.location.pathname}?${searchParams.toString()}`);
    return result.pledgeId;
  }

  function handleMessagesChange(messages: PledgeChatMessage[]) {
    setMessages(messages);
    const applied = messages
      .filter((message) => message.role === 'assistant')
      .reduce<PledgeChatPatch>(
        (patch, message) => ({ ...patch, ...message.proposedPatch }),
        {},
      );
    setDraftPatch(applied);
  }

  const progress = getPledgeProgress(draftPatch);

  return (
    <div className="mt-8 grid gap-5">
      <div className="border-y border-line bg-panel-muted px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold">약정 내용 완성도</p>
          <p className="text-sm font-bold text-accent">{progress.percent}%</p>
        </div>
        <div
          aria-label={`약정 내용 완성도 ${progress.percent}%`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={progress.percent}
          className="mt-3 h-2 overflow-hidden rounded-full bg-line"
          role="progressbar"
        >
          <div
            className="h-full bg-accent"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
        {!progress.missing.length ? (
          <p aria-live="polite" className="mt-2 text-xs text-success">
            약정서 작성이 완료됐어요. 다음 화면에서 내용을 검토해 주세요.
          </p>
        ) : null}
      </div>
      <PledgeChatPanel
        initialMessages={initialMessages}
        onEnsurePledge={ensurePledge}
        onMessagesChange={handleMessagesChange}
        renderContextualHelp={(select) => (
          <ImpactSummaryPanel
            onSelectActivity={select}
            organizationId={organizationId}
          />
        )}
      />
      <div className="flex flex-wrap items-center justify-end gap-3">
        {error ? (
          <p className="mr-auto text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <Button
          disabled={!pledgeId}
          loading={loading}
          onClick={() => void openPledge()}
          size="large"
        >
          약정서 확인하기
        </Button>
        {!pledgeId ? (
          <p className="w-full text-right text-xs text-copy-muted">
            첫 답변을 보내면 작성 중인 약정서를 검토할 수 있습니다.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function getAppliedPatch(messages: PledgeChatMessage[]) {
  return messages
    .filter((message) => message.role === 'assistant')
    .reduce<PledgeChatPatch>(
      (patch, message) => ({ ...patch, ...message.proposedPatch }),
      {},
    );
}

function getPledgeProgress(patch: PledgeChatPatch) {
  const fields: Array<[keyof PledgeChatPatch, string, boolean]> = [
    ['amount', '기부 금액', typeof patch.amount === 'number'],
    ['donationDesignation', '기부 유형', Boolean(patch.donationDesignation)],
    [
      'donationCondition',
      '기부 조건',
      patch.donationDesignation === 'undesignated' ||
        Boolean(patch.donationCondition),
    ],
    ['paymentSchedule', '납부 시점', Boolean(patch.paymentSchedule)],
    [
      'paymentScheduleOther',
      '기타 납부 시점',
      patch.paymentSchedule !== 'other' || Boolean(patch.paymentScheduleOther),
    ],
    ['paymentMethod', '납부 수단', Boolean(patch.paymentMethod)],
    [
      'paymentMethodOther',
      '기타 납부 수단',
      patch.paymentMethod !== 'other' || Boolean(patch.paymentMethodOther),
    ],
  ];
  const applicable = fields.filter(([field]) => {
    if (field === 'donationCondition')
      return Boolean(patch.donationDesignation);
    if (field === 'paymentScheduleOther') return Boolean(patch.paymentSchedule);
    if (field === 'paymentMethodOther') return Boolean(patch.paymentMethod);
    return true;
  });
  const completed = applicable.filter(([, , done]) => done).length;
  return {
    percent: Math.round((completed / applicable.length) * 100),
    missing: applicable.filter(([, , done]) => !done).map(([, label]) => label),
  };
}

'use client';

import { useState } from 'react';

import { PlanReviewForm } from '@/components/partner/plan-review-form';
import {
  PlanUploadForm,
  type EligibleDonation,
} from '@/components/partner/plan-upload-form';
import type { PlanDraft } from '@/lib/plans/types';

const EMPTY_PLAN: PlanDraft = {
  title: '',
  periodStart: '',
  periodEnd: '',
  totalAmount: null,
  items: [
    {
      id: 'manual-item-1',
      name: '',
      description: '',
      amount: null,
      confidence: null,
      sourceText: '',
      sourceName: '',
      sourceAmount: null,
    },
  ],
};

export function PlanCreationForm({
  donations,
  initialDonationId,
}: {
  donations: EligibleDonation[];
  initialDonationId?: string;
}) {
  const [method, setMethod] = useState<'manual' | 'ocr'>('manual');

  return (
    <div className="mt-8 grid max-w-[920px] gap-8">
      <fieldset className="grid gap-3">
        <legend className="text-sm font-bold">등록 방법</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex cursor-pointer gap-3 rounded-[var(--radius-md)] border border-line bg-panel p-4">
            <input
              checked={method === 'manual'}
              name="plan-method"
              onChange={() => setMethod('manual')}
              type="radio"
            />
            <span>
              <span className="block text-sm font-bold">직접 작성</span>
              <span className="mt-1 block text-xs text-copy-muted">
                파일 없이 계획명, 기간, 예산 항목을 입력합니다.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer gap-3 rounded-[var(--radius-md)] border border-line bg-panel p-4">
            <input
              checked={method === 'ocr'}
              name="plan-method"
              onChange={() => setMethod('ocr')}
              type="radio"
            />
            <span>
              <span className="block text-sm font-bold">파일로 자동 입력</span>
              <span className="mt-1 block text-xs text-copy-muted">
                PDF 또는 이미지를 OCR로 분석한 뒤 검토합니다.
              </span>
            </span>
          </label>
        </div>
      </fieldset>

      {method === 'manual' ? (
        <PlanReviewForm
          donations={donations}
          initialDraft={EMPTY_PLAN}
          initialIssues={[]}
          initialDonationId={initialDonationId}
        />
      ) : (
        <PlanUploadForm
          donations={donations}
          initialDonationId={initialDonationId}
        />
      )}
    </div>
  );
}

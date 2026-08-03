export type DonationProgressInput = {
  pledgeStatus: string | null;
  paymentStatus: string | null;
  plans: { status: string }[];
  executions: { status: string }[];
  reports: { status: string }[];
};

export type DonationProgress = {
  key:
    | 'needs-signature'
    | 'payment'
    | 'plan'
    | 'executing'
    | 'report'
    | 'completed';
  label: string;
  tone: 'warning' | 'success' | 'neutral';
  nextAction: string;
  nextActionKind:
    'signature' | 'payment' | 'plan' | 'execution' | 'report' | null;
};

export function getDonationProgress(
  input: DonationProgressInput,
): DonationProgress {
  if (input.pledgeStatus !== 'signed') {
    return {
      key: 'needs-signature',
      label: '기부처 서명 필요',
      tone: 'warning',
      nextAction: '약정 서명 확인',
      nextActionKind: 'signature',
    };
  }

  if (input.paymentStatus !== 'completed') {
    return {
      key: 'payment',
      label: '결제 대기',
      tone: 'warning',
      nextAction: '결제 상태 확인',
      nextActionKind: 'payment',
    };
  }

  const registeredPlans = input.plans.filter(
    (plan) => plan.status === 'registered',
  );
  if (registeredPlans.length === 0) {
    return {
      key: 'plan',
      label: '집행 계획 필요',
      tone: 'warning',
      nextAction: '계획서 등록',
      nextActionKind: 'plan',
    };
  }

  const registeredExecutions = input.executions.filter(
    (execution) => execution.status === 'registered',
  );
  if (registeredExecutions.length === 0) {
    return {
      key: 'executing',
      label: '집행 증빙 필요',
      tone: 'warning',
      nextAction: '영수증 등록',
      nextActionKind: 'execution',
    };
  }

  if (!input.reports.some((report) => report.status === 'published')) {
    return {
      key: 'report',
      label: '완료 보고 필요',
      tone: 'warning',
      nextAction: '보고서 작성',
      nextActionKind: 'report',
    };
  }

  return {
    key: 'completed',
    label: '완료',
    tone: 'success',
    nextAction: '진행 내용 확인',
    nextActionKind: null,
  };
}

export type DonationMilestone = {
  key: 'pledge' | 'payment' | 'plan' | 'execution' | 'report';
  label: string;
  detail: string;
  state: 'complete' | 'current' | 'pending';
};

export function getDonationMilestones(
  input: DonationProgressInput,
): DonationMilestone[] {
  const planRegistered = input.plans.some(
    (plan) => plan.status === 'registered',
  );
  const executionRegistered = input.executions.some(
    (execution) => execution.status === 'registered',
  );
  const reportPublished = input.reports.some(
    (report) => report.status === 'published',
  );
  const progress = getDonationProgress(input);
  const current = progress.nextActionKind;

  return [
    {
      key: 'pledge' as const,
      label: '약정 체결',
      detail:
        input.pledgeStatus === 'signed' ? '양측 서명 완료' : '기부처 서명 필요',
      state:
        input.pledgeStatus === 'signed'
          ? 'complete'
          : current === 'signature'
            ? 'current'
            : 'pending',
    },
    {
      key: 'payment' as const,
      label: '기부 결제',
      detail: input.paymentStatus === 'completed' ? '결제 완료' : '결제 대기',
      state:
        input.paymentStatus === 'completed'
          ? 'complete'
          : current === 'payment'
            ? 'current'
            : 'pending',
    },
    {
      key: 'plan' as const,
      label: '집행 계획',
      detail: planRegistered
        ? `${input.plans.length}건 등록 완료`
        : '등록 필요',
      state: planRegistered
        ? 'complete'
        : current === 'plan'
          ? 'current'
          : 'pending',
    },
    {
      key: 'execution' as const,
      label: '집행 증빙',
      detail: executionRegistered
        ? `${input.executions.length}건 등록 완료`
        : '영수증 등록 필요',
      state: executionRegistered
        ? 'complete'
        : current === 'execution'
          ? 'current'
          : 'pending',
    },
    {
      key: 'report' as const,
      label: '완료 보고',
      detail: reportPublished ? '공개 완료' : '작성 필요',
      state: reportPublished
        ? 'complete'
        : current === 'report'
          ? 'current'
          : 'pending',
    },
  ];
}

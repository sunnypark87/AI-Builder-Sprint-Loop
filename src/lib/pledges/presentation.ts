import type { StatusTone } from '@/components/ui/status-indicator';

import type { PledgeStatus } from './status';

const pledgeStatusPresentation: Record<
  PledgeStatus,
  { label: string; tone: StatusTone }
> = {
  draft: { label: '약정 작성 중', tone: 'neutral' },
  awaiting_donor_signature: { label: '기부자 서명 필요', tone: 'warning' },
  awaiting_organization_signature: {
    label: '기부처 서명 대기',
    tone: 'warning',
  },
  signed: { label: '양측 서명 완료', tone: 'success' },
  declined: { label: '서명 거절', tone: 'neutral' },
  cancelled: { label: '약정 취소', tone: 'neutral' },
  expired: { label: '약정 만료', tone: 'neutral' },
};

export function getPledgeStatusPresentation(status: string) {
  if (!(status in pledgeStatusPresentation)) {
    return { label: '상태 확인 필요', tone: 'neutral' as const };
  }
  return pledgeStatusPresentation[status as PledgeStatus];
}

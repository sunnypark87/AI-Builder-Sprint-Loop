import type { StatusTone } from '@/components/ui/status-indicator';

import type { PaymentStatus } from './status';

const paymentStatusPresentation: Record<
  PaymentStatus,
  { label: string; tone: StatusTone }
> = {
  pending: { label: '결제 처리 중', tone: 'warning' },
  completed: { label: '결제 완료', tone: 'success' },
  failed: { label: '결제 실패', tone: 'danger' },
  cancelled: { label: '결제 취소', tone: 'neutral' },
};

export function getPaymentStatusPresentation(
  status: string | null | undefined,
) {
  if (!status || !(status in paymentStatusPresentation)) {
    return { label: '결제 대기', tone: 'neutral' as const };
  }
  return paymentStatusPresentation[status as PaymentStatus];
}

import { Card } from '@/components/ui/card';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { getPaymentStatusPresentation } from '@/lib/payments/presentation';

export function OrganizationPledgeCompletionPanel({
  payment,
}: {
  payment: { status: string; updated_at: string } | null;
}) {
  const paymentStatus = getPaymentStatusPresentation(payment?.status);

  return (
    <Card className="mt-8 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-copy-muted">서명 상태</p>
          <StatusIndicator className="mt-2" tone="success">
            양측 서명 완료
          </StatusIndicator>
        </div>
        <div className="text-right">
          <p className="text-sm text-copy-muted">기부자 결제 상태</p>
          <StatusIndicator className="mt-2" tone={paymentStatus.tone}>
            {paymentStatus.label}
          </StatusIndicator>
        </div>
      </div>
      <p className="mt-5 border-t border-line pt-4 text-sm text-copy-muted">
        기부자가 앱에서 결제를 완료하면 이 화면의 결제 상태에 반영됩니다.
        {payment
          ? ` 최근 변경: ${new Date(payment.updated_at).toLocaleDateString('ko-KR')}`
          : ''}
      </p>
    </Card>
  );
}

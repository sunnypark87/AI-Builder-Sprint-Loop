import { PageHeader } from '@/components/partner/page-header';
import { Card } from '@/components/ui/card';
import { CheckIcon, CircleIcon, Clock3Icon } from 'lucide-react';
export default function Page() {
  return (
    <div className="max-w-[960px]">
      <PageHeader
        context="기부 상세"
        title="김모아 님 기부 이행"
        description="약정, 결제, 계획, 집행과 보고 진행 상태를 확인합니다."
      />
      <Card className="mt-8 divide-y divide-line">
        {[
          ['약정 체결', '완료', 'success'],
          ['8월 결제', '완료', 'success'],
          ['집행 계획', '공개됨', 'brand'],
          ['집행 내역', '등록 중', 'warning'],
          ['완료 보고', '대기', 'neutral'],
        ].map(([a, b, c]) => (
          <div className="grid grid-cols-[24px_1fr] gap-3 p-5" key={a}>
            {c === 'success' ? (
              <CheckIcon aria-label="완료" className="size-4 text-success" />
            ) : c === 'brand' || c === 'warning' ? (
              <Clock3Icon
                aria-label="진행 중"
                className="size-4 text-accent-strong"
              />
            ) : (
              <CircleIcon
                aria-label="대기"
                className="size-4 text-copy-disabled"
              />
            )}
            <div>
              <strong>{a}</strong>
              <p className="mt-1 text-sm text-copy-muted">{b}</p>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

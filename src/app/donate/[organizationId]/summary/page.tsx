import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { buttonClassName } from '@/components/ui/button';
import { FlowProgress } from '@/components/ui/flow-progress';
import { getOrganization } from '@/lib/mock-data/organizations';
export default async function SummaryPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const org = getOrganization(organizationId);
  if (!org) notFound();
  return (
    <main className="mx-auto max-w-[760px] px-4 py-12">
      <FlowProgress current={2} />
      <h1 className="mt-8 text-3xl font-bold">약정 조건을 확인해 주세요</h1>
      <Card className="mt-8 divide-y divide-line">
        {[
          ['기부처', org.name],
          ['기부 목적', '아동 교육 프로그램'],
          ['기부 금액', '매월 50,000원'],
          ['기부 기간', '12개월'],
          ['집행 보고', '계획·집행 내역·완료 보고 알림'],
        ].map(([a, b]) => (
          <div className="grid grid-cols-[120px_1fr] p-4 text-sm" key={a}>
            <span className="text-copy-muted">{a}</span>
            <strong>{b}</strong>
          </div>
        ))}
      </Card>
      <p className="mt-4 text-sm leading-6 text-copy-muted">
        AI가 상담을 요약한 예시입니다. 잘못 이해한 조건이 있다면 약정서 생성
        전에 수정해야 합니다.
      </p>
      <div className="mt-8 flex justify-between">
        <Link
          className={buttonClassName({ variant: 'secondary' })}
          href={`/donate/${org.id}/consultation`}
        >
          상담으로 돌아가기
        </Link>
        <Link className={buttonClassName()} href="/pledges/demo/review">
          약정서 생성하기
        </Link>
      </div>
    </main>
  );
}

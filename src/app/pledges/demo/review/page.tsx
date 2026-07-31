import Link from 'next/link';
import { buttonClassName } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FlowProgress } from '@/components/ui/flow-progress';
import { getOrganization } from '@/lib/mock-data/organizations';

export default async function PledgeReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ organizationId?: string }>;
}) {
  const { organizationId = 'haebom' } = await searchParams;
  const organization =
    getOrganization(organizationId) ?? getOrganization('haebom')!;
  const terms = [
    ['기부처', organization.name],
    ['기부 목적', organization.donationPurpose],
    ['기부 금액', '월 50,000원'],
    ['약정 기간', '2026. 08. 01. ~ 2027. 07. 31.'],
    ['집행 공개', '계획 등록, 집행 증빙 등록, 완료 보고 시 알림'],
    ['중도 해지', '다음 결제일 3일 전까지 요청 시 이후 결제 중단'],
  ];

  return (
    <main className="mx-auto max-w-[860px] px-4 py-12 md:px-6">
      <FlowProgress current={3} />
      <h1 className="mt-8 text-3xl font-bold">기부 약정서를 확인해 주세요</h1>
      <p className="mt-3 text-sm leading-6 text-copy-muted">
        AI가 상담을 바탕으로 작성한 예시 약정서입니다. 실제 계약이나 결제가
        발생하지 않습니다.
      </p>
      <Card className="mt-8 overflow-hidden">
        <div className="border-b border-line bg-panel-muted px-6 py-5">
          <p className="text-xs font-medium text-copy-muted">
            모두기브 표준 기부 약정서 · 예시
          </p>
          <h2 className="mt-1 text-xl font-bold">
            {organization.name} 정기 기부 약정
          </h2>
        </div>
        <dl className="divide-y divide-line">
          {terms.map(([label, value]) => (
            <div
              className="grid gap-2 px-6 py-4 text-sm sm:grid-cols-[140px_1fr]"
              key={label}
            >
              <dt className="text-copy-muted">{label}</dt>
              <dd className="font-medium leading-6">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <div className="mt-8 flex flex-wrap justify-between gap-3">
        <Link
          className={buttonClassName({ variant: 'secondary' })}
          href={`/donate/${organization.id}/summary`}
        >
          조건 수정하기
        </Link>
        <Link
          className={buttonClassName({ size: 'large' })}
          href={`/pledges/demo/sign?organizationId=${organization.id}`}
        >
          검토 완료 · 서명하기
        </Link>
      </div>
    </main>
  );
}

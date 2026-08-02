import { CircleCheckBigIcon } from 'lucide-react';
import Link from 'next/link';
import { buttonClassName } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getOrganization } from '@/lib/mock-data/organizations';

export default async function PaymentResultPage({
  searchParams,
}: {
  searchParams: Promise<{ organizationId?: string }>;
}) {
  const { organizationId = 'haebom' } = await searchParams;
  const organization =
    getOrganization(organizationId) ?? getOrganization('haebom')!;

  return (
    <main className="mx-auto max-w-[680px] px-4 py-16 text-center">
      <CircleCheckBigIcon className="mx-auto size-12 text-success" />
      <p className="mt-4 text-sm font-medium text-success">결제 완료</p>
      <h1 className="mt-2 text-3xl font-bold">기부 여정이 시작됐어요</h1>
      <p className="mt-3 text-sm leading-6 text-copy-muted">
        집행 계획과 내역이 등록될 때마다 알림으로 알려드려요.
      </p>
      <Card className="mt-8 p-5 text-left">
        <div className="flex justify-between text-sm">
          <span className="text-copy-muted">기부처</span>
          <strong>{organization.name}</strong>
        </div>
        <div className="mt-3 flex justify-between text-sm">
          <span className="text-copy-muted">예시 금액</span>
          <strong>50,000원</strong>
        </div>
      </Card>
      <div className="mt-8 flex justify-center gap-2">
        <Link
          className={buttonClassName({ variant: 'secondary' })}
          href="/organizations"
        >
          기부처 더 보기
        </Link>
        <Link
          className={buttonClassName()}
          href={`/donations/demo?organizationId=${organization.id}`}
        >
          기부 이행 확인
        </Link>
      </div>
    </main>
  );
}

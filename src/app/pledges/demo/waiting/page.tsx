import Link from 'next/link';
import { CheckIcon, CircleIcon, Clock3Icon } from 'lucide-react';
import { buttonClassName } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getOrganization } from '@/lib/mock-data/organizations';

export default async function PledgeWaitingPage({
  searchParams,
}: {
  searchParams: Promise<{ organizationId?: string }>;
}) {
  const { organizationId = 'haebom' } = await searchParams;
  const organization =
    getOrganization(organizationId) ?? getOrganization('haebom')!;

  return (
    <main className="mx-auto max-w-[720px] px-4 py-12 md:px-6">
      <p className="text-sm text-copy-muted">약정 진행 상태</p>
      <h1 className="mt-2 text-3xl font-bold">
        {organization.name}이 약정서를 확인하고 있어요
      </h1>
      <Card className="mt-8 p-6">
        <Clock3Icon className="size-8 text-warning" />
        <ol className="mt-5 grid gap-4 text-sm">
          <li className="flex items-center gap-2 font-medium">
            <CheckIcon aria-hidden="true" className="size-4" /> 기부자 약정 검토
            및 예시 서명
          </li>
          <li className="flex items-center gap-2 font-medium text-warning">
            <CircleIcon aria-hidden="true" className="size-3 fill-current" />{' '}
            기부처 약정 검토 및 서명
          </li>
          <li className="flex items-center gap-2 text-copy-disabled">
            <CircleIcon aria-hidden="true" className="size-3" /> 결제 진행
          </li>
        </ol>
        <p className="mt-6 border-t border-line pt-5 text-sm leading-6 text-copy-muted">
          기부처 서명이 완료되면 알림을 보내고 결제 화면을 열어드립니다.
        </p>
      </Card>
      <div className="mt-8 flex flex-wrap gap-2">
        <Link
          className={buttonClassName({ variant: 'secondary' })}
          href="/my-donations"
        >
          내 기부에서 확인
        </Link>
        <Link
          className={buttonClassName()}
          href={`/donations/demo/payment?organizationId=${organization.id}`}
        >
          데모: 서명 완료 후 결제 보기
        </Link>
      </div>
    </main>
  );
}

import { BellIcon, CheckIcon, CircleIcon } from 'lucide-react';
import { getOrganization } from '@/lib/mock-data/organizations';

export default async function DonationPage({
  searchParams,
}: {
  searchParams: Promise<{ organizationId?: string }>;
}) {
  const { organizationId = 'haebom' } = await searchParams;
  const organization =
    getOrganization(organizationId) ?? getOrganization('haebom')!;
  const timeline = [
    ['약정 체결', '양측 서명 완료', '완료'],
    ['기부 결제', '2026년 8월 결제', '완료'],
    ['집행 계획', `${organization.donationPurpose} 집행 계획 공개`, '새 소식'],
    ['집행 내역', '아직 등록된 내역이 없습니다.', '대기'],
    ['완료 보고서', '집행 완료 후 개인화 보고서가 생성됩니다.', '대기'],
  ];

  return (
    <main className="mx-auto max-w-[900px] px-4 py-12 md:px-6">
      <p className="text-sm text-copy-muted">기부 진행 현황 · 데모 데이터</p>
      <h1 className="mt-2 text-3xl font-bold">{organization.name} 기부 이행</h1>
      <p className="mt-2 text-sm text-copy-muted">
        약정부터 집행 보고까지 한 흐름으로 확인합니다.
      </p>
      <ol className="mt-8 divide-y divide-line border-y border-line">
        {timeline.map(([title, desc, status]) => (
          <li className="grid grid-cols-[24px_1fr] gap-3 py-5" key={title}>
            <span className="pt-0.5">
              {status === '완료' ? (
                <CheckIcon aria-label="완료" className="size-4 text-success" />
              ) : status === '새 소식' ? (
                <BellIcon
                  aria-label="새 소식"
                  className="size-4 text-accent-strong"
                />
              ) : (
                <CircleIcon
                  aria-label="대기"
                  className="size-4 text-copy-disabled"
                />
              )}
            </span>
            <div>
              <h2 className="font-bold">{title}</h2>
              <p className="mt-1 text-sm text-copy-muted">{desc}</p>
            </div>
          </li>
        ))}
      </ol>
    </main>
  );
}

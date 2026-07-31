import { StatusIndicator } from '@/components/ui/status-indicator';
import { getOrganization } from '@/lib/mock-data/organizations';

export default async function MyDonationsPage({
  searchParams,
}: {
  searchParams: Promise<{ organizationId?: string }>;
}) {
  const { organizationId = 'haebom' } = await searchParams;
  const organization =
    getOrganization(organizationId) ?? getOrganization('haebom')!;

  return (
    <main className="mx-auto max-w-[1100px] px-4 py-12 md:px-6">
      <p className="text-sm text-copy-muted">기부 내역 · 데모 데이터</p>
      <h1 className="mt-2 text-3xl font-bold">내 기부</h1>
      <div className="mt-8 border-y border-line">
        <section className="grid gap-4 py-5 md:grid-cols-[1fr_auto]">
          <div>
            <p className="text-sm text-copy-muted">{organization.name}</p>
            <h2 className="mt-1 text-lg font-bold">
              {organization.donationPurpose} 정기 기부
            </h2>
            <p className="mt-2 text-sm text-copy-muted">
              기부처가 약정서에 서명하면 결제를 진행할 수 있습니다.
            </p>
            <StatusIndicator className="mt-3" tone="warning">
              기부처 서명 대기
            </StatusIndicator>
          </div>
          <div className="text-sm md:text-right">
            <p className="text-copy-muted">월 기부액</p>
            <strong className="text-xl">50,000원</strong>
          </div>
        </section>
      </div>
    </main>
  );
}

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { buttonClassName } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getOrganization, organizations } from '@/lib/mock-data/organizations';

export function generateStaticParams() {
  return organizations.map((x) => ({ organizationId: x.id }));
}
export default async function OrganizationPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const org = getOrganization(organizationId);
  if (!org) notFound();
  return (
    <main className="mx-auto max-w-[1100px] px-4 py-12 md:px-6 lg:px-9">
      <p className="text-sm text-copy-muted">기부처 찾기 / {org.name}</p>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          <p className="text-sm text-copy-muted">{org.category}</p>
          <h1 className="mt-2 text-4xl font-bold">{org.name}</h1>
          <p className="mt-4 text-lg leading-8 text-copy-muted">
            {org.summary}
          </p>
          <section className="mt-10 border-t border-line pt-8">
            <h2 className="text-2xl font-bold">공개 자료 분석</h2>
            <p className="mt-2 text-sm text-copy-muted">
              공개 자료를 바탕으로 구성한 데모 분석이며 실제 평가가 아닙니다.
              최근 갱신 {org.latestReport}
            </p>
            <div className="mt-5 grid gap-3">
              {org.allocation.map((x) => (
                <div key={x.label}>
                  <div className="flex justify-between text-sm">
                    <span>{x.label}</span>
                    <strong>{x.value}%</strong>
                  </div>
                  <div className="mt-2 h-2 bg-panel-muted">
                    <div
                      className="h-full bg-accent"
                      style={{ width: `${x.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
        <aside>
          <Card className="sticky top-24 p-5">
            <p className="text-sm text-copy-muted">확인된 공개 항목</p>
            <p className="mt-1 text-3xl font-bold">
              {org.verifiedItems}/{org.totalItems}
            </p>
            <p className="mt-4 text-sm leading-6 text-copy-muted">
              기부 조건은 AI 상담 후 약정서에서 다시 확인합니다.
            </p>
            <Link
              className={buttonClassName({
                className: 'mt-6 w-full',
                size: 'large',
              })}
              href={`/donate/${org.id}/consultation`}
            >
              이 기부처에 기부하기
            </Link>
          </Card>
        </aside>
      </div>
    </main>
  );
}

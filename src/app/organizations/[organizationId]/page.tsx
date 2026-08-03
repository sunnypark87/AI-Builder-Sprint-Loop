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
            <h2 className="text-2xl font-bold">기부금 활용 목적</h2>
            <p className="mt-3 text-base leading-7 text-copy-muted">
              {org.donationPurpose}
            </p>
            <p className="mt-2 text-sm text-copy-muted">
              활동 지역 {org.location}
            </p>
          </section>
        </div>
        <aside>
          <Card className="sticky top-24 p-5">
            <h2 className="text-lg font-bold">기부 안내</h2>
            <p className="mt-3 text-sm leading-6 text-copy-muted">
              AI 상담에서 기부 목적과 조건을 정리한 뒤 약정서를 작성합니다.
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

import Link from 'next/link';

import { FilterTabs } from '@/components/ui/filter-tabs';
import { organizations } from '@/lib/mock-data/organizations';

const categories = [
  '전체',
  ...new Set(organizations.map((organization) => organization.category)),
];

export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category = '전체' } = await searchParams;
  const visible =
    category === '전체'
      ? organizations
      : organizations.filter((org) => org.category === category);

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-12 md:px-6 lg:px-9">
      <p className="text-sm text-copy-muted">데모 기부처</p>
      <h1 className="mt-2 text-3xl font-bold">기부처 찾기</h1>
      <p className="mt-3 text-copy-muted">
        관심 분야와 활동 내용을 살펴보고 기부처를 선택해 보세요.
      </p>
      <div className="mt-8">
        <FilterTabs
          label="기부 분야"
          items={categories.map((item) => ({
            label: item,
            href:
              item === '전체'
                ? '/organizations'
                : `/organizations?category=${encodeURIComponent(item)}`,
            active: category === item,
            count:
              item === '전체'
                ? organizations.length
                : organizations.filter((org) => org.category === item).length,
          }))}
        />
      </div>
      <div className="mt-6 divide-y divide-line border-y border-line">
        {visible.map((org) => (
          <Link
            className="block py-6 hover:bg-panel-muted md:px-4"
            href={`/organizations/${org.id}`}
            key={org.id}
          >
            <div className="grid gap-5 md:grid-cols-[1fr_280px]">
              <div>
                <p className="text-sm text-copy-muted">{org.category}</p>
                <h2 className="mt-1 text-xl font-bold">{org.name}</h2>
                <p className="mt-2 text-sm text-copy-muted">{org.summary}</p>
              </div>
              <div className="border-l-0 border-line md:border-l md:pl-6">
                <p className="text-xs text-copy-muted">기부금 활용 목적</p>
                <p className="mt-1 text-sm font-medium leading-6">
                  {org.donationPurpose}
                </p>
                <p className="mt-2 text-xs text-copy-muted">{org.location}</p>
              </div>
            </div>
          </Link>
        ))}
        {visible.length === 0 ? (
          <div className="py-12 text-center">
            <p className="font-bold">해당 분야의 기부처가 없습니다.</p>
            <Link
              className="mt-2 inline-block text-sm text-copy-muted underline underline-offset-4"
              href="/organizations"
            >
              전체 기부처 보기
            </Link>
          </div>
        ) : null}
      </div>
    </main>
  );
}

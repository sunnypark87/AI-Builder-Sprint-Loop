import { CheckIcon } from 'lucide-react';
import Link from 'next/link';

import { FilterTabs } from '@/components/ui/filter-tabs';
import { organizations } from '@/lib/mock-data/organizations';

const categories = ['전체', '아동·청소년', '환경', '지역사회'];

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
      <p className="text-sm text-copy-muted">공개 자료 기반 · 데모 데이터</p>
      <h1 className="mt-2 text-3xl font-bold">기부처 찾기</h1>
      <p className="mt-3 text-copy-muted">
        관심 분야와 공개 자료를 비교해 기부처를 살펴보세요.
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
            <div className="grid gap-5 md:grid-cols-[1fr_auto]">
              <div>
                <p className="text-sm text-copy-muted">{org.category}</p>
                <h2 className="mt-1 text-xl font-bold">{org.name}</h2>
                <p className="mt-2 text-sm text-copy-muted">{org.summary}</p>
                <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-success">
                  {org.tags.map((tag) => (
                    <li className="flex items-center gap-1" key={tag}>
                      <CheckIcon aria-hidden="true" className="size-3.5" />
                      {tag}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="min-w-44 border-l-0 border-line md:border-l md:pl-6">
                <p className="text-xs text-copy-muted">공개 자료 확인</p>
                <p className="mt-1 text-2xl font-bold">
                  {org.verifiedItems}/{org.totalItems}
                </p>
                <p className="mt-2 text-xs text-copy-muted">
                  최근 갱신 {org.latestReport}
                </p>
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

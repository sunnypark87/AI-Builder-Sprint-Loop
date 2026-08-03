'use client';

import { ChevronDownIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { organizations } from '@/lib/mock-data/organizations';

const categories = [
  '전체',
  ...new Set(organizations.map((item) => item.category)),
];

export function OrganizationShowcase() {
  const [category, setCategory] = useState('전체');
  const visible = organizations.filter(
    (item) => category === '전체' || item.category === category,
  );

  return (
    <section className="border-t border-line bg-panel py-20 md:py-28">
      <div className="mx-auto max-w-[1120px] px-4 md:px-6 lg:px-9">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm text-copy-muted">분야별 기부처</p>
          <h2 className="mt-3 text-3xl font-bold leading-tight tracking-[-0.04em] md:text-4xl">
            관심 있는 분야의
            <br />
            기부처를 알아보세요
          </h2>
          <p className="mt-5 text-sm leading-6 text-copy-muted md:text-base">
            관심 분야와 활동 내용을 살펴보고 기부처를 선택해 보세요.
          </p>
          <label className="relative mx-auto mt-8 block max-w-sm text-left">
            <span className="sr-only">기부 분야 선택</span>
            <select
              className="h-13 w-full appearance-none rounded-[var(--radius-sm)] border border-line bg-panel px-4 pr-12 text-sm font-medium hover:border-copy-disabled"
              onChange={(event) => setCategory(event.target.value)}
              value={category}
            >
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item === '전체' ? '기부 분야를 선택해 주세요' : item}
                </option>
              ))}
            </select>
            <ChevronDownIcon className="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2" />
          </label>
        </div>
        <div
          aria-live="polite"
          className="mt-12 grid grid-cols-1 sm:grid-cols-2 md:mt-16 lg:grid-cols-4"
        >
          {visible.map((organization) => (
            <Link
              className="group flex min-h-52 flex-col items-center justify-center px-5 py-8 text-center transition-colors hover:bg-panel-muted md:min-h-60"
              href={`/organizations/${organization.id}`}
              key={organization.id}
            >
              <span className="text-sm text-copy-muted">
                {organization.category}
              </span>
              <span className="mt-2 text-xl font-bold tracking-[-0.04em] md:text-2xl">
                {organization.name}
              </span>
              <span className="mt-4 text-sm leading-6 text-copy-muted">
                {organization.summary}
              </span>
            </Link>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link
            className="inline-flex min-h-11 items-center border-b border-copy text-sm font-medium"
            href="/organizations"
          >
            모든 기부처 보기
          </Link>
        </div>
      </div>
    </section>
  );
}

import { ArrowRightIcon } from 'lucide-react';
import Link from 'next/link';

import { OrganizationShowcase } from '@/components/organizations/organization-showcase';
import { buttonClassName } from '@/components/ui/button';

export default function Home() {
  return (
    <main>
      <section className="border-b border-line bg-accent-soft">
        <div className="mx-auto max-w-[1200px] px-4 py-16 md:px-6 lg:px-9 lg:py-24">
          <div className="max-w-3xl">
            <p className="flex items-center gap-2 text-sm font-bold text-accent-strong">
              <span aria-hidden="true" className="h-px w-6 bg-accent" />
              신뢰가 이어지는 기부
            </p>
            <h1 className="mt-5 max-w-2xl text-4xl font-bold leading-tight tracking-[-0.04em] text-copy md:text-5xl">
              기부 이후의 이야기를
              <br />
              끝까지 확인하세요
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-copy-muted">
              기부처의 공개 자료를 이해하기 쉽게 분석하고, 약정부터 집행
              보고까지 하나의 흐름으로 연결합니다.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                className={buttonClassName({ size: 'large' })}
                href="/organizations"
              >
                기부처 둘러보기 <ArrowRightIcon className="size-4" />
              </Link>
              <Link
                className="min-h-11 py-3 text-sm font-medium underline-offset-4 hover:underline"
                href="/partner/register"
              >
                기부처 등록하기
              </Link>
            </div>
          </div>
          <p className="mt-14 border-t border-orange-100 pt-5 text-sm leading-6 text-copy-muted">
            공개 자료의 출처와 갱신일을 표시하고, 계획과 실제 집행의 차이 및
            아직 확인되지 않은 항목을 함께 안내합니다.
          </p>
        </div>
      </section>
      <OrganizationShowcase />
    </main>
  );
}

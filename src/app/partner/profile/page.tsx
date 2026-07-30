import { PageHeader } from '@/components/partner/page-header';
export default function Page() {
  return (
    <div className="max-w-[880px]">
      <PageHeader
        context="기부처 정보"
        title="해봄재단 공개 프로필"
        description="기부자에게 공개되는 기본 정보와 검증 자료 상태를 관리합니다."
      />
      <section className="mt-8 border-y border-line py-6">
        <div className="flex flex-wrap justify-between gap-6">
          <div>
            <h2 className="text-xl font-bold">해봄재단</h2>
            <p className="mt-2 text-sm text-copy-muted">
              돌봄 공백 아동의 방과 후 배움과 식사를 지원합니다.
            </p>
          </div>
          <div className="w-full max-w-56 text-sm">
            <div className="flex justify-between">
              <span className="font-bold">공개 정보 확인</span>
              <span>8/9</span>
            </div>
            <div className="mt-2 h-1.5 bg-line">
              <div className="h-full w-[88.89%] bg-warning" />
            </div>
            <p className="mt-2 text-xs text-warning">1개 항목 확인 필요</p>
          </div>
        </div>
      </section>
    </div>
  );
}

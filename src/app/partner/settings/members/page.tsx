import { PageHeader } from '@/components/partner/page-header';
export default function Page() {
  return (
    <div className="max-w-[880px]">
      <PageHeader
        title="구성원·권한"
        description="약정 서명, 집행 검토와 보고서 발행 권한을 담당자별로 관리합니다."
      />
      <section className="mt-8 border-y border-line py-5">
        <strong>모두기브 파트너 관리자</strong>
        <p className="mt-2 text-sm text-copy-muted">
          예시 계정 · 전체 관리 권한
        </p>
      </section>
    </div>
  );
}

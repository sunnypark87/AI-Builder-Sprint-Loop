import { PageHeader } from '@/components/partner/page-header';
export default function Page() {
  return (
    <div className="max-w-[880px]">
      <PageHeader
        title="알림 설정"
        description="약정 도착, AI 분석 완료와 검토 기한 알림을 설정합니다."
      />
      <section className="mt-8 divide-y divide-line border-y border-line">
        {['새 약정 도착', 'AI 분석 완료', '보고서 발행 필요'].map((x) => (
          <label
            className="flex justify-between p-5 text-sm font-medium"
            key={x}
          >
            {x}
            <input
              defaultChecked
              type="checkbox"
              className="size-5 accent-accent"
            />
          </label>
        ))}
      </section>
    </div>
  );
}

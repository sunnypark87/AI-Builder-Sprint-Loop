import { notFound } from 'next/navigation';
import Link from 'next/link';
import { buttonClassName } from '@/components/ui/button';
import { FlowProgress } from '@/components/ui/flow-progress';
import { getOrganization } from '@/lib/mock-data/organizations';

export default async function ConsultationPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const org = getOrganization(organizationId);
  if (!org) notFound();
  return (
    <main className="mx-auto max-w-[960px] px-4 py-10 md:px-6">
      <FlowProgress current={1} />
      <h1 className="mt-8 text-3xl font-bold">{org.name} 기부 상담</h1>
      <p className="mt-2 text-sm text-copy-muted">
        아래 내용은 예시 대화입니다. 약정서 생성 전 조건을 다시 확인합니다.
      </p>
      <div className="mt-8 grid gap-6 border-y border-line py-6">
        <div className="max-w-[80%]">
          <p className="text-xs font-bold text-accent-strong">모두기브 AI</p>
          <p className="mt-2 text-sm leading-6">
            어떤 활동에 얼마를, 어떤 주기로 기부하고 싶은지 알려주세요.
          </p>
        </div>
        <div className="ml-auto max-w-[80%] rounded-[var(--radius-md)] bg-accent-soft px-4 py-3">
          <p className="text-sm leading-6">
            아동 교육 프로그램에 매월 5만원씩 1년 동안 기부하고 싶어요.
          </p>
        </div>
        <div className="max-w-[80%]">
          <p className="text-xs font-bold text-accent-strong">모두기브 AI</p>
          <p className="mt-2 text-sm leading-6">
            월 5만원, 12개월 정기 기부로 이해했어요. 중도 해지와 집행 보고
            조건을 포함해 상담 요약을 준비할게요.
          </p>
        </div>
      </div>
      <div className="mt-8 flex justify-end">
        <Link
          className={buttonClassName({ size: 'large' })}
          href={`/donate/${org.id}/summary`}
        >
          상담 요약 확인
        </Link>
      </div>
    </main>
  );
}

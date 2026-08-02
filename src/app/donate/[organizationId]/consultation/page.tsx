import { notFound } from 'next/navigation';
import { ConsultationWorkspace } from '@/components/pledges/consultation-workspace';
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
      <h1 className="text-3xl font-bold">{org.name} AI 약정 도우미</h1>
      <p className="mt-2 max-w-[720px] text-sm leading-6 text-copy-muted">
        기부하고 싶은 내용을 자유롭게 이야기해 주세요. AI가 약정 항목으로 정리해
        약정서 초안에 자동으로 작성합니다. 전체 내용은 다음 검토 화면에서 직접
        수정할 수 있습니다.
      </p>
      <div className="mt-5 border border-line bg-panel-muted px-4 py-3 text-xs leading-5 text-copy-muted">
        AI 제안은 약정 작성을 돕기 위한 참고 정보이며 법률 검증이 아닙니다. 재단
        활동 안내는 재단이 등록하고 승인한 자료만을 기준으로 표시합니다.
      </div>
      <ConsultationWorkspace
        initialMessages={[
          {
            content:
              '어떤 활동에 얼마를, 어떤 주기로 기부하고 싶은지 알려주세요.',
            role: 'assistant',
          },
        ]}
        organizationId={org.id}
      />
    </main>
  );
}

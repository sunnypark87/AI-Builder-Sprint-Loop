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
      <h1 className="text-3xl font-bold">{org.name} 기부 상담</h1>
      <p className="mt-2 max-w-[720px] text-sm leading-6 text-copy-muted">
        기부하고 싶은 내용은 자유롭게 이야기해 주세요. 내용이 모두 정해지지
        않아도 약정서를 먼저 확인하고 나중에 보완할 수 있습니다.
      </p>
      <ConsultationWorkspace
        initialMessages={[
          {
            content:
              '어떤 활동에 얼마를, 어떤 주기로 기부하고 싶은지 알려주세요.',
            role: 'assistant',
          },
          { content: `${org.donationPurpose}에 관심이 있어요.`, role: 'user' },
          {
            content:
              '좋아요. 금액이나 기간을 정하지 않아도 괜찮아요. 약정서를 열어 내용을 직접 확인하고 수정할 수 있어요.',
            role: 'assistant',
          },
        ]}
        organizationId={org.id}
      />
    </main>
  );
}

import { FlowProgress } from '@/components/ui/flow-progress';
import { PledgeSignForm } from '@/components/pledges/pledge-sign-form';
import { getOrganization } from '@/lib/mock-data/organizations';

export default async function PledgeSignPage({
  searchParams,
}: {
  searchParams: Promise<{ organizationId?: string }>;
}) {
  const { organizationId = 'haebom' } = await searchParams;
  const organization =
    getOrganization(organizationId) ?? getOrganization('haebom')!;

  return (
    <main className="mx-auto max-w-[680px] px-4 py-12 md:px-6">
      <FlowProgress current={4} />
      <h1 className="mt-8 text-3xl font-bold">약정 동의와 서명</h1>
      <PledgeSignForm organizationId={organization.id} />
    </main>
  );
}

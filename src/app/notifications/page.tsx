import { getOrganization } from '@/lib/mock-data/organizations';

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ organizationId?: string }>;
}) {
  const { organizationId = 'haebom' } = await searchParams;
  const organization =
    getOrganization(organizationId) ?? getOrganization('haebom')!;

  return (
    <main className="mx-auto max-w-[800px] px-4 py-12">
      <h1 className="text-3xl font-bold">알림</h1>
      <section className="mt-8 border-y border-line py-5">
        <p className="text-sm font-bold">
          {organization.name}이 약정서를 확인하고 있습니다.
        </p>
        <p className="mt-2 text-xs text-copy-muted">데모 알림 · 10분 전</p>
      </section>
    </main>
  );
}

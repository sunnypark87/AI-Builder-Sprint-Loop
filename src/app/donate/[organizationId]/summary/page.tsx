import { redirect } from 'next/navigation';

export default async function SummaryPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  redirect(`/donate/${organizationId}/consultation`);
}

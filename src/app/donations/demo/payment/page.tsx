import { PaymentForm } from '@/components/donations/payment-form';
import { getOrganization } from '@/lib/mock-data/organizations';

export default async function PaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ organizationId?: string }>;
}) {
  const { organizationId = 'haebom' } = await searchParams;
  const organization =
    getOrganization(organizationId) ?? getOrganization('haebom')!;

  return <PaymentForm organization={organization} />;
}

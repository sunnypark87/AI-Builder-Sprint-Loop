import type { SupabaseClient } from '@supabase/supabase-js';

import {
  getDonationMilestones,
  getDonationProgress,
  type DonationMilestone,
  type DonationProgress,
} from './donation-detail';

type DonationRow = {
  id: string;
  organization_id: string;
  pledge_id: string | null;
  amount: number;
  status: string;
  created_at: string;
};

type PledgeRow = {
  id: string;
  donor_name: string;
  amount: number;
  donation_type: string;
  purpose: string;
  pledge_date: string;
  donation_condition: string | null;
  status: string;
};

export type PartnerDonationDetail = {
  donation: DonationRow;
  pledge: PledgeRow | null;
  payment: { status: string; updated_at: string } | null;
  plans: {
    id: string;
    title: string | null;
    status: string;
    period_start: string | null;
    period_end: string | null;
    updated_at: string;
  }[];
  executions: {
    id: string;
    plan_id: string;
    status: string;
    updated_at: string;
  }[];
  reports: { id: string; title: string; status: string; updated_at: string }[];
  progress: DonationProgress;
  milestones: DonationMilestone[];
};

function first<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function getPartnerDonationDetail(
  client: SupabaseClient,
  donationId: string,
  organizationId: string,
): Promise<PartnerDonationDetail | null> {
  const { data: donation, error: donationError } = await client
    .from('donations')
    .select('id,organization_id,pledge_id,amount,status,created_at')
    .eq('id', donationId)
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (donationError || !donation) return null;

  const donationRow = donation as DonationRow;
  const [
    { data: pledge },
    { data: payment },
    { data: plans },
    { data: executions },
    { data: reports },
  ] = await Promise.all([
    donationRow.pledge_id
      ? client
          .from('pledges')
          .select(
            'id,donor_name,amount,donation_type,purpose,pledge_date,donation_condition,status',
          )
          .eq('id', donationRow.pledge_id)
          .eq('organization_id', organizationId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    donationRow.pledge_id
      ? client
          .from('demo_payments')
          .select('status,updated_at')
          .eq('pledge_id', donationRow.pledge_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    client
      .from('expenditure_plans')
      .select('id,title,status,period_start,period_end,updated_at')
      .eq('donation_id', donationId)
      .eq('organization_id', organizationId)
      .order('updated_at', { ascending: false }),
    client
      .from('expenditure_executions')
      .select('id,plan_id,status,updated_at')
      .eq('donation_id', donationId)
      .eq('organization_id', organizationId)
      .order('updated_at', { ascending: false }),
    client
      .from('donation_reports')
      .select('id,title,status,updated_at')
      .eq('donation_id', donationId)
      .eq('organization_id', organizationId)
      .order('updated_at', { ascending: false }),
  ]);

  const detail = {
    donation: donationRow,
    pledge: first(pledge as PledgeRow | PledgeRow[] | null),
    payment: first(payment as { status: string; updated_at: string } | null),
    plans: (plans ?? []) as PartnerDonationDetail['plans'],
    executions: (executions ?? []) as PartnerDonationDetail['executions'],
    reports: (reports ?? []) as PartnerDonationDetail['reports'],
  };
  const progressInput = {
    pledgeStatus: detail.pledge?.status ?? null,
    paymentStatus: detail.payment?.status ?? null,
    plans: detail.plans,
    executions: detail.executions,
    reports: detail.reports,
  };
  return {
    ...detail,
    progress: getDonationProgress(progressInput),
    milestones: getDonationMilestones(progressInput),
  };
}

export async function listPartnerDonationDetails(
  client: SupabaseClient,
  organizationId: string,
) {
  const { data: donations, error } = await client
    .from('donations')
    .select('id')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const details = await Promise.all(
    (donations ?? []).map((donation) =>
      getPartnerDonationDetail(client, donation.id as string, organizationId),
    ),
  );
  return details.filter(
    (detail): detail is PartnerDonationDetail => detail !== null,
  );
}

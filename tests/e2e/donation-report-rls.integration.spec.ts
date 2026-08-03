import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

import {
  reportRlsIds,
  reportRlsUsers,
} from './donation-report-rls.integration.setup';

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Supabase test environment is missing.');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function authenticatedClient(
  account: (typeof reportRlsUsers)[keyof typeof reportRlsUsers],
) {
  const supabase = client();
  const { error } = await supabase.auth.signInWithPassword(account);
  if (error) throw error;
  return supabase;
}

test('organization member can read draft and published reports', async () => {
  const supabase = await authenticatedClient(reportRlsUsers.manager);
  const { data, error } = await supabase
    .from('donation_reports')
    .select('id,status')
    .eq('organization_id', reportRlsIds.organization)
    .order('id');

  expect(error).toBeNull();
  expect(data).toEqual([
    { id: reportRlsIds.reviewReport, status: 'review_required' },
    { id: reportRlsIds.publishedReport, status: 'published' },
  ]);
});

test('donor can read only the safe projection of their published report', async () => {
  const supabase = await authenticatedClient(reportRlsUsers.donor);
  const { data, error } = await supabase
    .from('donation_reports')
    .select('id,status')
    .eq('organization_id', reportRlsIds.organization);

  expect(error).toBeNull();
  expect(data).toEqual([]);

  const { data: publishedReports, error: projectionError } = await supabase.rpc(
    'get_published_donation_reports',
    {
      p_pledge_id: reportRlsIds.publishedPledge,
    },
  );
  expect(projectionError).toBeNull();
  expect(publishedReports).toHaveLength(1);
  expect(publishedReports?.[0].id).toBe(reportRlsIds.publishedReport);
  expect(Object.keys(publishedReports?.[0] ?? {}).sort()).toEqual(
    [
      'evidence_snapshot',
      'id',
      'period_end',
      'period_start',
      'published_at',
      'published_content',
      'title',
    ].sort(),
  );

  const { error: updateError } = await supabase
    .from('donation_reports')
    .update({ title: '변조 시도' })
    .eq('id', reportRlsIds.publishedReport);
  expect(updateError).not.toBeNull();
});

test('unrelated donor and anonymous client cannot read reports', async () => {
  const outsider = await authenticatedClient(reportRlsUsers.outsider);
  const anonymous = client();
  const [outsiderResult, anonymousResult] = await Promise.all([
    outsider.rpc('get_published_donation_reports', {
      p_pledge_id: reportRlsIds.publishedPledge,
    }),
    anonymous.rpc('get_published_donation_reports', {
      p_pledge_id: reportRlsIds.publishedPledge,
    }),
  ]);

  expect(outsiderResult.error).toBeNull();
  expect(outsiderResult.data).toEqual([]);
  expect(anonymousResult.error).not.toBeNull();
});

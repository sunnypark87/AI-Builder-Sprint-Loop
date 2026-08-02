create or replace function public.review_pledge_ai_proposal(
  p_pledge_id uuid,
  p_proposal_id uuid,
  p_action text,
  p_expected_version integer
) returns table (pledge_id uuid, pledge_version integer, proposal_status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  proposal_row public.pledge_ai_proposals%rowtype;
  pledge_row public.pledges%rowtype;
  patch jsonb;
begin
  if p_action not in ('accept', 'reject') then
    raise exception using errcode = 'P0001', message = 'invalid_proposal_action';
  end if;

  select * into proposal_row
  from public.pledge_ai_proposals
  where id = p_proposal_id and status = 'pending'
    and pledge_id = p_pledge_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'proposal_not_available';
  end if;

  select * into pledge_row
  from public.pledges
  where id = proposal_row.pledge_id
    and donor_user_id = auth.uid()
    and status = 'draft'
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'pledge_not_editable';
  end if;
  if pledge_row.version <> p_expected_version then
    raise exception using errcode = 'P0001', message = 'pledge_changed';
  end if;

  if p_action = 'reject' then
    update public.pledge_ai_proposals
    set status = 'rejected', reviewed_at = now()
    where id = p_proposal_id;
    return query select pledge_row.id, pledge_row.version, 'rejected'::text;
    return;
  end if;

  patch := proposal_row.proposed_patch;
  if patch ? 'amount' and (jsonb_typeof(patch->'amount') <> 'number' or (patch->>'amount')::numeric <= 0) then
    raise exception using errcode = 'P0001', message = 'invalid_proposal_patch';
  end if;
  if patch ? 'donationDesignation' and patch->>'donationDesignation' not in ('designated', 'undesignated') then
    raise exception using errcode = 'P0001', message = 'invalid_proposal_patch';
  end if;
  if patch->>'donationDesignation' = 'designated'
    and (not (patch ? 'donationCondition') or nullif(trim(patch->>'donationCondition'), '') is null) then
    raise exception using errcode = 'P0001', message = 'invalid_proposal_patch';
  end if;
  if patch->>'donationDesignation' = 'undesignated' then
    patch := patch || '{"donationCondition":null}'::jsonb;
  end if;

  update public.pledges
  set amount = case when patch ? 'amount' then (patch->>'amount')::numeric else amount end,
      donation_designation = case when patch ? 'donationDesignation' then patch->>'donationDesignation' else donation_designation end,
      donation_condition = case when patch ? 'donationCondition' then nullif(patch->>'donationCondition', '') else donation_condition end,
      payment_schedule = case when patch ? 'paymentSchedule' then patch->>'paymentSchedule' else payment_schedule end,
      payment_schedule_other = case when patch ? 'paymentScheduleOther' then nullif(patch->>'paymentScheduleOther', '') else payment_schedule_other end,
      payment_method = case when patch ? 'paymentMethod' then patch->>'paymentMethod' else payment_method end,
      payment_method_other = case when patch ? 'paymentMethodOther' then nullif(patch->>'paymentMethodOther', '') else payment_method_other end,
      version = version + 1,
      updated_at = now()
  where id = pledge_row.id and version = p_expected_version;

  update public.pledge_ai_proposals
  set status = 'accepted', reviewed_patch = patch, reviewed_at = now()
  where id = p_proposal_id;
  update public.pledge_ai_proposals
  set status = 'superseded', reviewed_at = now()
  where pledge_id = pledge_row.id and id <> p_proposal_id and status = 'pending';

  return query select pledge_row.id, p_expected_version + 1, 'accepted'::text;
end;
$$;

revoke all on function public.review_pledge_ai_proposal(uuid, uuid, text, integer) from public;
grant execute on function public.review_pledge_ai_proposal(uuid, uuid, text, integer) to authenticated;

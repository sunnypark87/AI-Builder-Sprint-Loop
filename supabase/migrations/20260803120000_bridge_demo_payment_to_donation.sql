alter table public.donations
  add column if not exists pledge_id uuid references public.pledges(id) on delete restrict;

create unique index if not exists donations_pledge_id_key
  on public.donations (pledge_id)
  where pledge_id is not null;

comment on column public.donations.pledge_id is
  'Optional source pledge for the demo signing/payment bridge. Legacy donations may remain unlinked.';

create or replace function public.create_paid_donation_for_demo_payment(
  p_actor_id uuid,
  p_pledge_id uuid,
  p_payment_id uuid
)
returns table (
  donation_id uuid,
  created boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_pledge public.pledges%rowtype;
  target_payment public.demo_payments%rowtype;
  target_donation_id uuid;
  inserted boolean := false;
begin
  select *
  into target_pledge
  from public.pledges
  where id = p_pledge_id
  for update;

  if target_pledge.id is null
    or target_pledge.donor_user_id is distinct from p_actor_id
    or target_pledge.status <> 'signed' then
    raise exception 'Paid donation requires a signed pledge owned by the actor';
  end if;

  if target_pledge.amount <> trunc(target_pledge.amount) then
    raise exception 'Paid donation amount must be a whole KRW amount';
  end if;

  select *
  into target_payment
  from public.demo_payments
  where id = p_payment_id
    and pledge_id = p_pledge_id
  for update;

  if target_payment.id is null
    or target_payment.donor_user_id is distinct from target_pledge.donor_user_id
    or target_payment.status <> 'completed' then
    raise exception 'Paid donation requires a completed matching demo payment';
  end if;

  select id
  into target_donation_id
  from public.donations
  where pledge_id = p_pledge_id
  for update;

  if target_donation_id is not null then
    return query select target_donation_id, false;
    return;
  end if;

  insert into public.donations (
    organization_id,
    amount,
    status,
    pledge_id
  )
  values (
    target_pledge.organization_id,
    target_pledge.amount::bigint,
    'paid',
    target_pledge.id
  )
  -- pledge_id is protected by a partial unique index because legacy
  -- donations may remain unlinked. An unqualified conflict handler works
  -- with that index while ON CONFLICT (pledge_id) cannot infer it.
  on conflict do nothing
  returning id into target_donation_id;

  inserted := target_donation_id is not null;

  if target_donation_id is null then
    select id
    into target_donation_id
    from public.donations
    where pledge_id = p_pledge_id;
  end if;

  if target_donation_id is null then
    raise exception 'Paid donation creation failed';
  end if;

  return query select target_donation_id, inserted;
end;
$$;

revoke all on function public.create_paid_donation_for_demo_payment(uuid, uuid, uuid)
  from public, authenticated;
grant execute on function public.create_paid_donation_for_demo_payment(uuid, uuid, uuid)
  to service_role;

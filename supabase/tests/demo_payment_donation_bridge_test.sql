begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values (
  '44444444-4444-4444-8444-444444444444',
  'authenticated',
  'authenticated',
  'bridge-donor@example.test',
  now(),
  now()
);

insert into public.organizations (id, slug, name)
values (
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'bridge-org',
  '브리지 조직'
);

insert into public.organization_members (organization_id, user_id, role)
values (
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  '44444444-4444-4444-8444-444444444444',
  'signer'
);

insert into public.pledges (
  id,
  donor_user_id,
  organization_id,
  status,
  amount,
  donation_type,
  purpose,
  pledge_date,
  donor_name,
  donor_address,
  donor_contact
)
values (
  'cccccccc-1000-4ccc-8ccc-cccccccccccc',
  '44444444-4444-4444-8444-444444444444',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'signed',
  50000,
  '일시후원',
  '브리지 RPC 검증',
  current_date,
  '테스트 기부자',
  '테스트 주소',
  '010-0000-0000'
);

insert into public.demo_payments (
  id,
  pledge_id,
  donor_user_id,
  method,
  status,
  idempotency_key
)
values (
  'cccccccc-2000-4ccc-8ccc-cccccccccccc',
  'cccccccc-1000-4ccc-8ccc-cccccccccccc',
  '44444444-4444-4444-8444-444444444444',
  'card',
  'completed',
  'bridge-test-payment-key'
);

set local role service_role;

select is(
  (select donation_id from public.create_paid_donation_for_demo_payment(
    '44444444-4444-4444-8444-444444444444',
    'cccccccc-1000-4ccc-8ccc-cccccccccccc',
    'cccccccc-2000-4ccc-8ccc-cccccccccccc'
  )),
  (select id from public.donations where pledge_id = 'cccccccc-1000-4ccc-8ccc-cccccccccccc'),
  'completed payment creates a donation linked to the pledge'
);
select is(
  (select created from public.create_paid_donation_for_demo_payment(
    '44444444-4444-4444-8444-444444444444',
    'cccccccc-1000-4ccc-8ccc-cccccccccccc',
    'cccccccc-2000-4ccc-8ccc-cccccccccccc'
  )),
  false,
  'repeating the bridge is idempotent'
);
select is(
  (select count(*) from public.donations where pledge_id = 'cccccccc-1000-4ccc-8ccc-cccccccccccc'),
  1::bigint,
  'a pledge has only one linked donation'
);
select is(
  (select amount from public.donations where pledge_id = 'cccccccc-1000-4ccc-8ccc-cccccccccccc'),
  50000::bigint,
  'the donation amount comes from the signed pledge'
);
select is(
  (select status from public.donations where pledge_id = 'cccccccc-1000-4ccc-8ccc-cccccccccccc'),
  'paid',
  'the bridged donation is paid'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.create_paid_donation_for_demo_payment(uuid,uuid,uuid)',
    'EXECUTE'
  ),
  'authenticated users cannot invoke the bridge RPC directly'
);
select throws_ok(
  $$
    select * from public.create_paid_donation_for_demo_payment(
      '33333333-3333-4333-8333-333333333333',
      'cccccccc-1000-4ccc-8ccc-cccccccccccc',
      'cccccccc-2000-4ccc-8ccc-cccccccccccc'
    )
  $$,
  'P0001',
  'Paid donation requires a signed pledge owned by the actor',
  'a different actor cannot bridge the payment'
);
select is(
  (select organization_id from public.donations where pledge_id = 'cccccccc-1000-4ccc-8ccc-cccccccccccc'),
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid,
  'the donation keeps the pledge organization'
);

rollback;

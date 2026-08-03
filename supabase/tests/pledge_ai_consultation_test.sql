begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'pledge-ai-a@example.test', now(), now()),
  ('22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'pledge-ai-b@example.test', now(), now());

insert into public.organizations (id, slug, name, description)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'pledge-ai-org', '해봄', '아동 교육 지원');

insert into public.pledges (
  id, donor_user_id, organization_id, status, amount, donation_type,
  purpose, pledge_date, donor_name, donor_address, donor_contact, version
)
values (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'draft', 100000, 'cash', '교육 지원', current_date,
  '기부자 A', '서울', '010-0000-0000', 1
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);

select ok(
  has_table_privilege('authenticated', 'public.pledge_ai_proposals', 'SELECT'),
  'authenticated users can read proposal rows through RLS'
);
select ok(
  not has_table_privilege('authenticated', 'public.pledge_ai_proposals', 'INSERT'),
  'authenticated users cannot insert proposal rows directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.pledge_ai_proposals', 'UPDATE'),
  'authenticated users cannot update proposal rows directly'
);
select ok(
  has_function_privilege('authenticated', 'public.complete_pledge_ai_consultation(uuid,text,jsonb,text[],text[],text[],text,integer,text,text,integer,integer,integer,integer,integer,text)', 'EXECUTE'),
  'authenticated users can execute the completion RPC'
);

insert into public.pledge_chat_messages (
  id, pledge_id, role, content, status, client_request_id
)
values (
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'user', '교육에 사용해 주세요.', 'pending',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
);

select is(
  (select count(*) from public.pledge_chat_messages where role = 'user' and status = 'pending'),
  1::bigint,
  'the donor can create a pending user message'
);

select lives_ok(
  $$
    select * from public.complete_pledge_ai_consultation(
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      '납부 수단을 알려주세요.',
      '{"donationDesignation":"designated"}'::jsonb,
      array['donationDesignation'], array[]::text[], array['paymentMethod'],
      'paymentMethod', 1, 'solar-pro3', 'provider-test-1', 1, 10,
      null, null, null, 'pledge-consultation-v1'
    )
  $$,
  'completion RPC atomically completes the consultation turn'
);
select is(
  (select count(*) from public.pledge_chat_messages where role = 'assistant' and reply_to_message_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
  1::bigint,
  'completion RPC creates one linked assistant message'
);
select is(
  (select count(*) from public.pledge_ai_proposals where pledge_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  1::bigint,
  'completion RPC creates one AI extraction audit record'
);
select is(
  (select donation_designation from public.pledges where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  'designated'::text,
  'completion RPC applies the extracted pledge field automatically'
);
select is(
  (select status from public.pledge_ai_proposals where pledge_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  'accepted'::text,
  'completion RPC marks the internal extraction audit as applied'
);

select throws_ok(
  $$
    insert into public.pledge_chat_messages (pledge_id, role, content, status)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'assistant', '임의 답변', 'completed')
  $$,
  '42501',
  'direct assistant message insertion is rejected'
);

select throws_ok(
  $$
    insert into public.pledge_ai_proposals (pledge_id, assistant_message_id, proposed_patch, pledge_version, model, prompt_version, attempt_count, duration_ms)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', gen_random_uuid(), '{}'::jsonb, 1, 'solar-pro3', 'test', 1, 1)
  $$,
  '42501',
  'direct AI proposal insertion is rejected'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);
select is(
  (select count(*) from public.pledge_chat_messages),
  0::bigint,
  'another donor cannot read the consultation messages'
);
select is(
  (select count(*) from public.pledge_ai_proposals),
  0::bigint,
  'another donor cannot read the AI proposals'
);

select * from finish();
rollback;

begin;

create extension if not exists pgtap with schema extensions;

select plan(30);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'member-a@example.test', now(), now()),
  ('22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'member-b@example.test', now(), now());

insert into public.organizations (id, name)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '조직 A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '조직 B');

insert into public.organization_members (organization_id, user_id, role)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'manager'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'manager');

insert into public.donations (id, organization_id, amount, status)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 100000, 'paid'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 100000, 'cancelled'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 200000, 'paid');

insert into public.expenditure_plans (
  id, organization_id, donation_id, created_by, status,
  source_file_name, source_mime_type, source_size_bytes,
  source_page_count, source_fingerprint, idempotency_key,
  analysis_lease_expires_at
)
values
  (
    'aaaaaaaa-1000-4000-8000-000000000001',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'aaaaaaaa-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    'analyzing', 'plan-a.pdf', 'application/pdf', 1024, 1,
    repeat('a', 64), 'plan-a-integration-key', now() + interval '2 minutes'
  ),
  (
    'bbbbbbbb-1000-4000-8000-000000000001',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'bbbbbbbb-0000-4000-8000-000000000001',
    '22222222-2222-4222-8222-222222222222',
    'analyzing', 'plan-b.pdf', 'application/pdf', 1024, 1,
    repeat('b', 64), 'plan-b-integration-key', now() + interval '2 minutes'
  );

insert into storage.objects (bucket_id, name)
values
  ('plan-documents', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/aaaaaaaa-1000-4000-8000-000000000001/source.pdf'),
  ('plan-documents', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/bbbbbbbb-1000-4000-8000-000000000001/source.pdf');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.expenditure_plans),
  1::bigint,
  'organization A member reads only organization A plans'
);
select is(
  (select count(*) from public.donations),
  2::bigint,
  'organization A member reads only organization A donations regardless of status'
);
select is(
  (select count(*) from storage.objects where bucket_id = 'plan-documents'),
  1::bigint,
  'organization A member reads only organization A source objects'
);
select ok(
  not has_table_privilege('authenticated', 'public.expenditure_plans', 'UPDATE'),
  'authenticated users cannot update plan rows directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.expenditure_plan_items', 'INSERT')
    and not has_table_privilege('authenticated', 'public.expenditure_plan_items', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.expenditure_plan_items', 'DELETE'),
  'authenticated users cannot mutate plan items directly'
);
select throws_ok(
  $$
    update public.expenditure_plans
    set status = 'registered'
    where id = 'aaaaaaaa-1000-4000-8000-000000000001'
  $$,
  '42501',
  'permission denied for table expenditure_plans',
  'direct plan status mutation is rejected'
);
select throws_ok(
  $$
    insert into public.expenditure_plan_items (
      plan_id, name, amount, sort_order
    ) values (
      'aaaaaaaa-1000-4000-8000-000000000001', '우회 항목', 100000, 0
    )
  $$,
  '42501',
  'permission denied for table expenditure_plan_items',
  'direct plan item mutation is rejected'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.create_expenditure_plan_analysis(uuid,uuid,uuid,text,text,text,bigint,integer,text)',
    'EXECUTE'
  )
    and not has_function_privilege(
      'authenticated',
      'public.save_plan_analysis(uuid,uuid,text,jsonb,jsonb,jsonb)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'authenticated',
      'public.mark_plan_analysis_failed(uuid,uuid,text,text)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'authenticated',
      'public.claim_plan_analysis_retry(uuid,uuid)',
      'EXECUTE'
    ),
  'authenticated users cannot invoke internal plan transition RPCs'
);
select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Organization members can delete plan documents'
  ),
  0::bigint,
  'authenticated users have no source document delete policy'
);

reset role;
set local role service_role;
select is(
  (
    select plan_id
    from public.create_expenditure_plan_analysis(
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'aaaaaaaa-0000-4000-8000-000000000001',
      'plan-a-integration-key',
      'plan-a.pdf',
      'application/pdf',
      1024,
      1,
      repeat('a', 64)
    )
  ),
  'aaaaaaaa-1000-4000-8000-000000000001'::uuid,
  'an idempotency conflict returns the winning plan'
);
select is(
  (
    select should_process
    from public.create_expenditure_plan_analysis(
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'aaaaaaaa-0000-4000-8000-000000000001',
      'plan-a-integration-key',
      'plan-a.pdf',
      'application/pdf',
      1024,
      1,
      repeat('a', 64)
    )
  ),
  false,
  'an idempotency conflict is reported as an existing plan'
);
select throws_ok(
  $$
    select *
    from public.create_expenditure_plan_analysis(
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'aaaaaaaa-0000-4000-8000-000000000001',
      'plan-a-integration-key',
      'different.pdf',
      'application/pdf',
      2048,
      1,
      repeat('e', 64)
    )
  $$,
  'P0001',
  'Plan idempotency key does not match source document',
  'an idempotency key cannot be reused for another source document'
);

select lives_ok(
  $$
    select public.save_plan_analysis(
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-1000-4000-8000-000000000001',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/aaaaaaaa-1000-4000-8000-000000000001/source.pdf',
      '{"title":"교육 지원","periodStart":"2026-08-01","periodEnd":"2026-08-31","totalAmount":100000,"items":[{"id":"item-1","name":"교재비","description":"교재 구입","amount":100000,"confidence":0.98,"sourceText":"교재비 100,000원","sourceName":"교재비","sourceAmount":100000}]}'::jsonb,
      '[]'::jsonb,
      '{"apiVersion":"1.1","modelVersion":"ocr-test","pageCount":1,"processedAt":"2026-08-01T00:00:00Z"}'::jsonb
    )
  $$,
  'organization A member saves OCR analysis atomically'
);
select is(
  (select status from public.expenditure_plans where id = 'aaaaaaaa-1000-4000-8000-000000000001'),
  'review_required',
  'analysis changes the plan to review-required'
);
select is(
  (select count(*) from public.plan_ocr_runs where plan_id = 'aaaaaaaa-1000-4000-8000-000000000001'),
  1::bigint,
  'analysis records one OCR audit row'
);

select lives_ok(
  $$
    select public.register_expenditure_plan(
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-1000-4000-8000-000000000001',
      '{"title":"교육 지원 수정","periodStart":"2026-08-01","periodEnd":"2026-08-31","totalAmount":100000,"items":[{"id":"item-1","name":"교재비 수정","description":"교재 구입","amount":100000,"confidence":0.98,"sourceText":"교재비 100,000원","sourceName":"교재비","sourceAmount":100000}]}'::jsonb
    )
  $$,
  'organization A member registers reviewed values'
);
select is(
  (select status from public.expenditure_plans where id = 'aaaaaaaa-1000-4000-8000-000000000001'),
  'registered',
  'registration changes the plan to registered'
);
select is(
  (select reviewed_by from public.expenditure_plans where id = 'aaaaaaaa-1000-4000-8000-000000000001'),
  '11111111-1111-4111-8111-111111111111'::uuid,
  'registration records the reviewing user'
);
select is(
  (select sum(amount) from public.expenditure_plan_items where plan_id = 'aaaaaaaa-1000-4000-8000-000000000001'),
  100000::numeric,
  'registration stores the confirmed item amount'
);
select ok(
  (select edited_by_reviewer from public.expenditure_plan_items where plan_id = 'aaaaaaaa-1000-4000-8000-000000000001'),
  'registration records that the reviewer edited the item'
);

select lives_ok(
  $$
    select public.register_expenditure_plan(
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-1000-4000-8000-000000000001',
      '{"title":"교육 지원 수정","periodStart":"2026-08-01","periodEnd":"2026-08-31","totalAmount":100000,"items":[{"id":"item-1","name":"교재비 수정","description":"교재 구입","amount":100000,"confidence":0.98,"sourceText":"교재비 100,000원","sourceName":"교재비","sourceAmount":100000}]}'::jsonb
    )
  $$,
  'repeated registration is idempotent'
);
select is(
  (select count(*) from public.expenditure_plan_items where plan_id = 'aaaaaaaa-1000-4000-8000-000000000001'),
  1::bigint,
  'idempotent registration does not duplicate items'
);

reset role;
update public.expenditure_plans
set status = 'review_required'
where id = 'bbbbbbbb-1000-4000-8000-000000000001';

set local role service_role;
select throws_ok(
  $$
    select public.register_expenditure_plan(
      '11111111-1111-4111-8111-111111111111',
      'bbbbbbbb-1000-4000-8000-000000000001',
      '{"title":"침범 시도","periodStart":"2026-08-01","periodEnd":"2026-08-31","totalAmount":200000,"items":[{"id":"x","name":"침범","description":"","amount":200000,"confidence":null,"sourceText":"","sourceName":"","sourceAmount":null}]}'::jsonb
    )
  $$,
  'P0001',
  'Plan is not available for registration',
  'organization A cannot register organization B plans'
);

reset role;
insert into public.expenditure_plans (
  id, organization_id, donation_id, created_by, status,
  source_file_name, source_mime_type, source_size_bytes,
  source_page_count, source_fingerprint, idempotency_key
)
values (
  'aaaaaaaa-1000-4000-8000-000000000002',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'aaaaaaaa-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111',
  'review_required', 'invalid-total.pdf', 'application/pdf', 1024, 1,
  repeat('c', 64), 'invalid-total-integration-key'
);

set local role service_role;
select throws_ok(
  $$
    select public.register_expenditure_plan(
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-1000-4000-8000-000000000002',
      '{"title":"합계 오류","periodStart":"2026-08-01","periodEnd":"2026-08-31","totalAmount":200000,"items":[{"id":"item-1","name":"교재비","description":"","amount":100000,"confidence":null,"sourceText":"","sourceName":"","sourceAmount":null}]}'::jsonb
    )
  $$,
  'P0001',
  'Plan item total does not match',
  'registration rejects a mismatched total'
);
select is(
  (select status from public.expenditure_plans where id = 'aaaaaaaa-1000-4000-8000-000000000002'),
  'review_required',
  'failed registration leaves the plan unregistered'
);
select is(
  (select count(*) from public.expenditure_plan_items where plan_id = 'aaaaaaaa-1000-4000-8000-000000000002'),
  0::bigint,
  'failed registration does not partially store items'
);

reset role;
insert into public.expenditure_plans (
  id, organization_id, donation_id, created_by, status,
  source_file_name, source_mime_type, source_size_bytes,
  source_page_count, source_fingerprint, idempotency_key,
  analysis_lease_expires_at
)
values (
  'aaaaaaaa-1000-4000-8000-000000000003',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'aaaaaaaa-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111',
  'analyzing', 'stale.pdf', 'application/pdf', 1024, 1,
  repeat('e', 64), 'stale-analysis-integration-key',
  now() - interval '1 minute'
);

set local role service_role;
select throws_ok(
  $$
    select *
    from public.create_expenditure_plan_analysis(
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'aaaaaaaa-0000-4000-8000-000000000002',
      'cancelled-donation-key',
      'cancelled.pdf',
      'application/pdf',
      1024,
      1,
      repeat('f', 64)
    )
  $$,
  'P0001',
  'Plan creation is not allowed',
  'cancelled donations cannot receive expenditure plans'
);
select is(
  (
    select should_process
    from public.create_expenditure_plan_analysis(
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'aaaaaaaa-0000-4000-8000-000000000001',
      'stale-analysis-integration-key',
      'stale.pdf',
      'application/pdf',
      1024,
      1,
      repeat('e', 64)
    )
  ),
  true,
  'an expired analyzing lease is reclaimed'
);
select is(
  (
    select should_process
    from public.create_expenditure_plan_analysis(
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'aaaaaaaa-0000-4000-8000-000000000001',
      'stale-analysis-integration-key',
      'stale.pdf',
      'application/pdf',
      1024,
      1,
      repeat('e', 64)
    )
  ),
  false,
  'a renewed analyzing lease blocks duplicate processing'
);

reset role;
update public.donations
set status = 'refunded'
where id = 'aaaaaaaa-0000-4000-8000-000000000001';

set local role service_role;
select throws_ok(
  $$
    select public.register_expenditure_plan(
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-1000-4000-8000-000000000002',
      '{"title":"환불 후 등록","periodStart":"2026-08-01","periodEnd":"2026-08-31","totalAmount":100000,"items":[{"id":"item-1","name":"교재비","description":"","amount":100000,"confidence":null,"sourceText":"","sourceName":"","sourceAmount":null}]}'::jsonb
    )
  $$,
  'P0001',
  'Plan is not available for registration',
  'refunded donations cannot register expenditure plans'
);

select * from finish();
rollback;

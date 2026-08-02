begin;

create extension if not exists pgtap with schema extensions;
select plan(27);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('81111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'execution-a@example.test', now(), now()),
  ('83333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'execution-a-peer@example.test', now(), now()),
  ('82222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'execution-b@example.test', now(), now());

insert into public.organizations (id, name)
values
  ('8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '집행 조직 A'),
  ('8bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '집행 조직 B');

insert into public.organization_members (organization_id, user_id, role)
values
  ('8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '81111111-1111-4111-8111-111111111111', 'manager'),
  ('8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '83333333-3333-4333-8333-333333333333', 'manager'),
  ('8bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '82222222-2222-4222-8222-222222222222', 'manager');

insert into public.donations (id, organization_id, amount, status, paid_at, paid_at_is_authoritative)
values
  ('8aaaaaaa-0000-4000-8000-000000000001', '8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 100000, 'paid', '2026-07-31T00:00:00Z', true),
  ('8bbbbbbb-0000-4000-8000-000000000001', '8bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 100000, 'paid', '2026-07-31T00:00:00Z', true);

insert into public.expenditure_plans (
  id, organization_id, donation_id, created_by, reviewed_by, status,
  title, period_start, period_end, total_amount,
  source_file_name, source_mime_type, source_size_bytes,
  source_page_count, source_fingerprint, idempotency_key, reviewed_at
)
values
  (
    '8aaaaaaa-1000-4000-8000-000000000001',
    '8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '8aaaaaaa-0000-4000-8000-000000000001',
    '81111111-1111-4111-8111-111111111111',
    '81111111-1111-4111-8111-111111111111',
    'registered', '8월 집행', '2026-08-01', '2026-08-31', 100000,
    'plan.pdf', 'application/pdf', 100, 1, repeat('8', 64),
    'execution-plan-key-0001', now()
  );

insert into public.expenditure_plan_items (
  id, plan_id, name, description, amount, sort_order
)
values (
  '8aaaaaaa-2000-4000-8000-000000000001',
  '8aaaaaaa-1000-4000-8000-000000000001',
  '식재료', '', 100000, 0
);

select has_table('public', 'expenditure_executions', 'execution table exists');
select has_table('public', 'execution_receipts', 'receipt table exists');
select has_table('public', 'receipt_ocr_runs', 'OCR audit table exists');
select has_table('public', 'receipt_verification_results', 'verification audit table exists');
select ok(
  not has_table_privilege('authenticated', 'public.expenditure_executions', 'UPDATE'),
  'authenticated users cannot update executions directly'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.register_expenditure_execution(uuid,uuid,jsonb,jsonb,text)',
    'EXECUTE'
  ),
  'authenticated users cannot execute the mutation RPC'
);

set local role service_role;
select lives_ok(
  $$
    select * from public.create_expenditure_execution_analysis(
      '81111111-1111-4111-8111-111111111111',
      '8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '8aaaaaaa-0000-4000-8000-000000000001',
      '8aaaaaaa-1000-4000-8000-000000000001',
      '8aaaaaaa-2000-4000-8000-000000000001',
      'execution-submit-key-0001',
      'receipt.png', 'image/png', 100, 1, repeat('a', 64)
    )
  $$,
  'an organization member creates an execution analysis'
);

select ok(
  (select analysis_lease_token is not null from public.expenditure_executions where idempotency_key = 'execution-submit-key-0001'),
  'a new analysis owns a lease token'
);
select is(
  (
    select should_process
    from public.create_expenditure_execution_analysis(
      '81111111-1111-4111-8111-111111111111',
      '8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '8aaaaaaa-0000-4000-8000-000000000001',
      '8aaaaaaa-1000-4000-8000-000000000001',
      '8aaaaaaa-2000-4000-8000-000000000001',
      'execution-submit-key-0001',
      'receipt.png', 'image/png', 100, 1, repeat('a', 64)
    )
  ),
  false,
  'an active analysis lease is not claimed twice'
);

update public.expenditure_executions
set analysis_lease_expires_at = now() - interval '1 second'
where idempotency_key = 'execution-submit-key-0001';

select is(
  (
    select should_process
    from public.create_expenditure_execution_analysis(
      '81111111-1111-4111-8111-111111111111',
      '8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '8aaaaaaa-0000-4000-8000-000000000001',
      '8aaaaaaa-1000-4000-8000-000000000001',
      '8aaaaaaa-2000-4000-8000-000000000001',
      'execution-submit-key-0001',
      'receipt.png', 'image/png', 100, 1, repeat('a', 64)
    )
  ),
  true,
  'an expired analysis lease can be reclaimed'
);

select lives_ok(
  $$
    select public.save_expenditure_execution_analysis(
      '81111111-1111-4111-8111-111111111111',
      (select id from public.expenditure_executions where idempotency_key = 'execution-submit-key-0001'),
      (select analysis_lease_token from public.expenditure_executions where idempotency_key = 'execution-submit-key-0001'),
      '8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/execution/source.png',
      '{"merchantName":"모두마트","businessNumber":"1208155297","transactionAt":"2026-08-02T10:00","supplyAmount":54545,"taxAmount":5455,"totalAmount":60000,"paymentMethod":"카드","approvalNumber":"12345678","items":[{"id":"item-1","name":"식재료","quantity":1,"amount":60000,"confidence":0.99,"sourceText":"식재료 60000","sourceName":"식재료","sourceAmount":60000}]}'::jsonb,
      '[]'::jsonb,
      '{"apiVersion":"1","modelVersion":"test","pageCount":1,"processedAt":"2026-08-02T00:00:00Z"}'::jsonb,
      '[{"code":"remaining_budget","version":1,"outcome":"passed","message":"예산 확인","evidence":"60000 / 100000"}]'::jsonb,
      '1208155297:2026-08-02T10:00:60000:12345678'
    )
  $$,
  'analysis results and evidence are saved'
);

select is(
  (select semantic_key from public.expenditure_executions where idempotency_key = 'execution-submit-key-0001'),
  null,
  'the OCR semantic key is deferred until reviewed registration'
);

select lives_ok(
  $$
    select public.register_expenditure_execution(
      '81111111-1111-4111-8111-111111111111',
      (select id from public.expenditure_executions where idempotency_key = 'execution-submit-key-0001'),
      '{"merchantName":"모두마트","businessNumber":"1208155297","transactionAt":"2026-08-02T10:30","supplyAmount":54545,"taxAmount":5455,"totalAmount":60000,"paymentMethod":"카드","approvalNumber":"87654321","items":[{"id":"item-1","name":"식재료","quantity":1,"amount":60000,"confidence":0.99,"sourceText":"식재료 60000","sourceName":"식재료","sourceAmount":60000}]}'::jsonb,
      '[{"code":"remaining_budget","version":1,"outcome":"passed","message":"예산 확인","evidence":"60000 / 100000"}]'::jsonb,
      ''
    )
  $$,
  'reviewed receipt registers atomically'
);

select is(
  (select status from public.expenditure_executions where idempotency_key = 'execution-submit-key-0001'),
  'registered',
  'registered status is stored'
);
select is(
  (select total_amount from public.expenditure_executions where idempotency_key = 'execution-submit-key-0001'),
  60000::bigint,
  'reviewed amount is stored'
);
select is(
  (select semantic_key from public.expenditure_executions where idempotency_key = 'execution-submit-key-0001'),
  '1208155297:2026-08-02T10:30:60000:87654321',
  'semantic key is recomputed from the final reviewed draft'
);

update public.expenditure_plan_items
set amount = 120000
where id = '8aaaaaaa-2000-4000-8000-000000000001';

insert into public.expenditure_executions (
  id, organization_id, donation_id, plan_id, plan_item_id, created_by,
  status, semantic_key, idempotency_key
)
values (
  '8aaaaaaa-3000-4000-8000-000000000003',
  '8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '8aaaaaaa-0000-4000-8000-000000000001',
  '8aaaaaaa-1000-4000-8000-000000000001',
  '8aaaaaaa-2000-4000-8000-000000000001',
  '81111111-1111-4111-8111-111111111111',
  'review_required',
  '1208155297:2026-08-02T09:00:60000:ocr-wrong',
  'execution-submit-key-0003'
);

select throws_ok(
  $$
    select public.register_expenditure_execution(
      '81111111-1111-4111-8111-111111111111',
      '8aaaaaaa-3000-4000-8000-000000000003',
      '{"merchantName":"모두마트","businessNumber":"1208155297","transactionAt":"2026-08-02T10:30","supplyAmount":54545,"taxAmount":5455,"totalAmount":60000,"paymentMethod":"카드","approvalNumber":"87654321","items":[{"id":"item-1","name":"식재료","quantity":1,"amount":60000,"confidence":0.99,"sourceText":"식재료 60000","sourceName":"식재료","sourceAmount":60000}]}'::jsonb,
      '[{"code":"remaining_budget","version":1,"outcome":"passed","message":"예산 확인","evidence":"60000 / 120000"}]'::jsonb,
      ''
    )
  $$,
  '23505',
  'duplicate key value violates unique constraint "expenditure_executions_semantic_key_idx"',
  'final reviewed semantic key prevents a duplicate transaction'
);

select lives_ok(
  $$
    select * from public.create_expenditure_execution_analysis(
      '81111111-1111-4111-8111-111111111111',
      '8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '8aaaaaaa-0000-4000-8000-000000000001',
      '8aaaaaaa-1000-4000-8000-000000000001',
      '8aaaaaaa-2000-4000-8000-000000000001',
      'execution-submit-key-0002',
      'stalled.png', 'image/png', 100, 1, repeat('b', 64)
    )
  $$,
  'a second analysis is created for stale retry coverage'
);
select lives_ok(
  $$
    select public.mark_execution_source_uploaded(
      '81111111-1111-4111-8111-111111111111',
      (select id from public.expenditure_executions where idempotency_key = 'execution-submit-key-0002'),
      (
        select organization_id::text || '/' || id::text || '/source.png'
        from public.expenditure_executions
        where idempotency_key = 'execution-submit-key-0002'
      ),
      (select analysis_lease_token from public.expenditure_executions where idempotency_key = 'execution-submit-key-0002')
    )
  $$,
  'the source path is recorded under the active lease'
);

update public.expenditure_executions
set analysis_lease_expires_at = now() - interval '1 second'
where idempotency_key = 'execution-submit-key-0002';

select is(
  (
    select count(*)
    from public.claim_execution_analysis_retry(
      '81111111-1111-4111-8111-111111111111',
      (select id from public.expenditure_executions where idempotency_key = 'execution-submit-key-0002')
    )
  ),
  1::bigint,
  'an expired analyzing row with a source is claimed for retry'
);
select is(
  (
    select count(*)
    from public.claim_execution_analysis_retry(
      '81111111-1111-4111-8111-111111111111',
      (select id from public.expenditure_executions where idempotency_key = 'execution-submit-key-0002')
    )
  ),
  0::bigint,
  'an active replacement lease cannot be claimed twice'
);

insert into storage.objects (bucket_id, name, owner_id)
values
  (
    'receipt-documents',
    '8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/pending/81111111-1111-4111-8111-111111111111/upload-a/source.png',
    '81111111-1111-4111-8111-111111111111'
  ),
  (
    'receipt-documents',
    '8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/pending/83333333-3333-4333-8333-333333333333/upload-peer/source.png',
    '83333333-3333-4333-8333-333333333333'
  );

insert into storage.objects (bucket_id, name, owner_id)
select
  'receipt-documents',
  execution.organization_id::text || '/' || execution.id::text || '/source.png',
  '81111111-1111-4111-8111-111111111111'::uuid
from public.expenditure_executions execution
where execution.idempotency_key = 'execution-submit-key-0001';

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"81111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
select is(
  (select count(*) from storage.objects where bucket_id = 'receipt-documents'),
  2::bigint,
  'the owning organization can read its receipt source and own pending upload'
);
select is(
  (
    select count(*)
    from storage.objects
    where name like '8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/pending/81111111-1111-4111-8111-111111111111/%'
  ),
  1::bigint,
  'an uploader can read their own pending receipt'
);
select is(
  (
    select count(*)
    from storage.objects
    where name like '8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/pending/83333333-3333-4333-8333-333333333333/%'
  ),
  0::bigint,
  'an organization peer cannot read another uploader pending receipt'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"82222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);
select is(
  (select count(*) from public.expenditure_executions),
  0::bigint,
  'another organization cannot read execution rows'
);
select is(
  (select count(*) from public.execution_receipts),
  0::bigint,
  'another organization cannot read receipt rows'
);
select is(
  (select count(*) from storage.objects where bucket_id = 'receipt-documents'),
  0::bigint,
  'another organization cannot read the receipt source'
);

select * from finish();
rollback;

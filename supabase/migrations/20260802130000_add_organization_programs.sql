create table if not exists public.organization_programs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  program_key text not null,
  name text not null,
  description text not null default '',
  target_groups text[] not null default '{}',
  activity_categories text[] not null default '{}',
  accepting_designated_donations boolean not null default false,
  review_status text not null default 'pending'
    check (review_status in ('pending', 'approved', 'rejected')),
  valid_from date,
  valid_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, program_key)
);

create table if not exists public.organization_program_conditions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.organization_programs(id) on delete cascade,
  condition_text text not null,
  condition_type text not null default 'allowed'
    check (condition_type in ('allowed', 'prohibited')),
  review_status text not null default 'pending'
    check (review_status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  unique (program_id, condition_text, condition_type)
);

alter table public.organization_impact_facts
  add column if not exists program_id uuid references public.organization_programs(id) on delete set null,
  add column if not exists metric_type text not null default 'output'
    check (metric_type in ('input', 'output', 'outcome', 'satisfaction')),
  add column if not exists measurement_method text;

alter table public.organization_ai_summaries
  add column if not exists schema_version text not null default 'impact-summary-v1';

create index if not exists organization_programs_public_idx
  on public.organization_programs (organization_id, review_status, accepting_designated_donations);
create index if not exists organization_program_conditions_program_idx
  on public.organization_program_conditions (program_id, review_status);
create index if not exists organization_impact_facts_program_id_idx
  on public.organization_impact_facts (program_id, review_status);

alter table public.organization_programs enable row level security;
alter table public.organization_program_conditions enable row level security;

create policy organization_programs_member_read
  on public.organization_programs for select to authenticated
  using (exists (
    select 1 from public.organization_members member
    where member.organization_id = organization_programs.organization_id
      and member.user_id = auth.uid()
  ));

create policy organization_programs_public_read
  on public.organization_programs for select to authenticated
  using (review_status = 'approved' and exists (
    select 1 from public.organizations organization
    where organization.id = organization_programs.organization_id
      and organization.is_public = true
  ));

create policy organization_program_conditions_member_read
  on public.organization_program_conditions for select to authenticated
  using (exists (
    select 1 from public.organization_programs program
    join public.organization_members member
      on member.organization_id = program.organization_id
    where program.id = organization_program_conditions.program_id
      and member.user_id = auth.uid()
  ));

create policy organization_program_conditions_public_read
  on public.organization_program_conditions for select to authenticated
  using (review_status = 'approved' and exists (
    select 1 from public.organization_programs program
    join public.organizations organization
      on organization.id = program.organization_id
    where program.id = organization_program_conditions.program_id
      and program.review_status = 'approved'
      and program.accepting_designated_donations = true
      and organization.is_public = true
  ));

revoke insert, update, delete on public.organization_programs from anon, authenticated;
revoke insert, update, delete on public.organization_program_conditions from anon, authenticated;

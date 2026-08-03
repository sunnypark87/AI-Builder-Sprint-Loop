create table if not exists public.organization_source_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  document_type text not null check (document_type in ('annual_report', 'program_report', 'policy', 'other')),
  reporting_period text,
  storage_path text not null,
  mime_type text not null default 'text/plain',
  content_hash text not null,
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  processing_status text not null default 'pending' check (processing_status in ('pending', 'processing', 'ready', 'failed')),
  review_status text not null default 'pending' check (review_status in ('pending', 'approved', 'rejected')),
  processing_error text,
  uploaded_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, content_hash)
);

create table if not exists public.organization_source_sections (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.organization_source_documents(id) on delete cascade,
  section_key text not null,
  heading text not null,
  content text not null,
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  unique (document_id, section_key)
);

create table if not exists public.organization_impact_facts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.organization_source_documents(id) on delete cascade,
  section_id uuid references public.organization_source_sections(id) on delete set null,
  program_key text,
  program_name text not null,
  metric_key text not null,
  metric_label text not null,
  numeric_value numeric,
  text_value text,
  unit text,
  reporting_period text,
  evidence_text text not null,
  review_status text not null default 'pending' check (review_status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  check (numeric_value is not null or text_value is not null)
);

create table if not exists public.organization_ai_summaries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.organization_source_documents(id) on delete cascade,
  summary_type text not null default 'impact' check (summary_type in ('impact', 'program', 'donation_guidance')),
  source_revision text not null,
  summary_json jsonb not null,
  model text,
  prompt_version text,
  processing_status text not null default 'pending' check (processing_status in ('pending', 'ready', 'failed')),
  review_status text not null default 'pending' check (review_status in ('pending', 'approved', 'rejected')),
  processing_error text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists organization_source_sections_document_idx
  on public.organization_source_sections (document_id, position);
create index if not exists organization_impact_facts_program_idx
  on public.organization_impact_facts (organization_id, program_key, review_status);
create index if not exists organization_ai_summaries_lookup_idx
  on public.organization_ai_summaries (organization_id, summary_type, review_status, created_at desc);

alter table public.organization_source_documents enable row level security;
alter table public.organization_source_sections enable row level security;
alter table public.organization_impact_facts enable row level security;
alter table public.organization_ai_summaries enable row level security;

create policy organization_source_documents_member_read
  on public.organization_source_documents for select to authenticated
  using (exists (
    select 1 from public.organization_members member
    where member.organization_id = organization_source_documents.organization_id
      and member.user_id = auth.uid()
  ));

create policy organization_source_sections_public_read
  on public.organization_source_sections for select to authenticated
  using (exists (
    select 1 from public.organization_source_documents document
    join public.organizations organization on organization.id = document.organization_id
    where document.id = organization_source_sections.document_id
      and document.visibility = 'public'
      and document.review_status = 'approved'
      and organization.is_public = true
  ));

create policy organization_impact_facts_public_read
  on public.organization_impact_facts for select to authenticated
  using (review_status = 'approved' and exists (
    select 1 from public.organizations organization
    where organization.id = organization_impact_facts.organization_id
      and organization.is_public = true
  ));

create policy organization_ai_summaries_public_read
  on public.organization_ai_summaries for select to authenticated
  using (processing_status = 'ready' and review_status = 'approved' and exists (
    select 1 from public.organizations organization
    where organization.id = organization_ai_summaries.organization_id
      and organization.is_public = true
  ));

revoke insert, update, delete on public.organization_source_documents from anon, authenticated;
revoke insert, update, delete on public.organization_source_sections from anon, authenticated;
revoke insert, update, delete on public.organization_impact_facts from anon, authenticated;
revoke insert, update, delete on public.organization_ai_summaries from anon, authenticated;

insert into storage.buckets (id, name, public)
values ('organization-source-documents', 'organization-source-documents', false)
on conflict (id) do nothing;

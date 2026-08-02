create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'signer', 'viewer')),
  signer_name text,
  signer_email text,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

-- Issue #7 creates these shared tables first. CREATE TABLE IF NOT EXISTS does
-- not add the signing-domain columns to an existing table, so reconcile the
-- shared schema before policies and signing queries reference those columns.
alter table public.organizations
  add column if not exists slug text,
  add column if not exists description text,
  add column if not exists is_public boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

update public.organizations
set slug = id::text
where slug is null;

alter table public.organizations
  alter column slug set default gen_random_uuid()::text,
  alter column slug set not null;

create unique index if not exists organizations_slug_key
  on public.organizations(slug);

alter table public.organization_members
  add column if not exists signer_name text,
  add column if not exists signer_email text;

alter table public.organization_members
  drop constraint if exists organization_members_role_check;
alter table public.organization_members
  add constraint organization_members_role_check
  check (role in ('owner', 'manager', 'member', 'signer', 'viewer'));

create table if not exists public.pledges (
  id uuid primary key default gen_random_uuid(),
  donor_user_id uuid not null references auth.users(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  status text not null default 'draft' check (
    status in (
      'draft',
      'preparing_signature',
      'awaiting_donor_signature',
      'awaiting_organization_signature',
      'signed',
      'declined',
      'cancelled',
      'expired'
    )
  ),
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'KRW' check (currency = 'KRW'),
  donation_type text not null,
  purpose text not null,
  pledge_date date not null,
  allocation_start_date date,
  allocation_end_date date,
  allocation_months integer check (allocation_months is null or allocation_months > 0),
  donation_condition text,
  donor_name text not null,
  donor_address text not null,
  donor_contact text not null,
  donor_email text,
  contact_person text,
  department text,
  receipt_requested boolean not null default false,
  receipt_recipient_name text,
  receipt_recipient_address text,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (allocation_end_date is null or allocation_start_date is null or allocation_end_date >= allocation_start_date)
);

create table if not exists public.signature_documents (
  id uuid primary key default gen_random_uuid(),
  pledge_id uuid not null unique references public.pledges(id) on delete cascade,
  provider text not null default 'modusign' check (provider = 'modusign'),
  template_id text not null,
  provider_document_id text unique,
  provider_status text,
  sync_status text not null default 'idle' check (
    sync_status in ('idle', 'syncing', 'failed', 'reconciliation_required')
  ),
  idempotency_key text not null unique,
  last_provider_updated_at timestamptz,
  last_synced_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.signature_participants (
  id uuid primary key default gen_random_uuid(),
  signature_document_id uuid not null references public.signature_documents(id) on delete cascade,
  role text not null check (role in ('donor', 'organization')),
  signing_order integer not null check (signing_order in (1, 2)),
  provider_participant_id text,
  status text not null default 'waiting' check (status in ('waiting', 'signed', 'declined')),
  signed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (signature_document_id, role),
  unique (signature_document_id, signing_order)
);

create table if not exists public.modusign_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text unique,
  provider_document_id text,
  event_type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error_code text
);

create table if not exists public.demo_payments (
  id uuid primary key default gen_random_uuid(),
  pledge_id uuid not null unique references public.pledges(id) on delete restrict,
  donor_user_id uuid not null references auth.users(id) on delete restrict,
  method text not null check (method in ('card', 'transfer', 'easy')),
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed', 'cancelled')),
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.demo_receipts (
  id uuid primary key default gen_random_uuid(),
  pledge_id uuid not null unique references public.pledges(id) on delete restrict,
  payment_id uuid unique references public.demo_payments(id) on delete restrict,
  receipt_number text not null unique,
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists pledges_donor_user_id_idx on public.pledges (donor_user_id);
create index if not exists pledges_organization_id_status_idx on public.pledges (organization_id, status);
create index if not exists signature_documents_provider_document_id_idx on public.signature_documents (provider_document_id);
create index if not exists signature_participants_provider_participant_id_idx on public.signature_participants (provider_participant_id);
create index if not exists modusign_webhook_events_document_id_idx on public.modusign_webhook_events (provider_document_id);
create index if not exists demo_payments_donor_user_id_idx on public.demo_payments (donor_user_id);

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.pledges enable row level security;
alter table public.signature_documents enable row level security;
alter table public.signature_participants enable row level security;
alter table public.modusign_webhook_events enable row level security;
alter table public.demo_payments enable row level security;
alter table public.demo_receipts enable row level security;

create or replace function public.is_organization_member(target_organization_id uuid, target_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.organization_members member
    where member.organization_id = target_organization_id and member.user_id = target_user_id
  );
$$;

create or replace function public.is_organization_signer(target_organization_id uuid, target_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.organization_members member
    where member.organization_id = target_organization_id
      and member.user_id = target_user_id
      and member.role in ('owner', 'signer')
  );
$$;

create policy organizations_public_read on public.organizations
  for select using (is_public or exists (
    select 1 from public.organization_members member
    where member.organization_id = organizations.id and member.user_id = auth.uid()
  ));

create policy organization_members_self_read on public.organization_members
  for select using (user_id = auth.uid());

create policy organization_members_owner_read on public.organization_members
  for select using (public.is_organization_signer(organization_members.organization_id));

create policy pledges_donor_read on public.pledges
  for select using (donor_user_id = auth.uid());

create policy pledges_organization_read on public.pledges
  for select using (public.is_organization_member(pledges.organization_id));

create policy pledges_donor_insert on public.pledges
  for insert with check (donor_user_id = auth.uid() and status = 'draft');

create policy pledges_donor_draft_update on public.pledges
  for update using (donor_user_id = auth.uid() and status = 'draft')
  with check (donor_user_id = auth.uid() and status = 'draft');

create policy signature_documents_participant_read on public.signature_documents
  for select using (exists (
    select 1 from public.pledges pledge
    where pledge.id = signature_documents.pledge_id
      and (pledge.donor_user_id = auth.uid() or public.is_organization_member(pledge.organization_id))
  ));

create policy signature_participants_participant_read on public.signature_participants
  for select using (exists (
    select 1 from public.signature_documents document
    join public.pledges pledge on pledge.id = document.pledge_id
    where document.id = signature_participants.signature_document_id
      and (pledge.donor_user_id = auth.uid() or public.is_organization_member(pledge.organization_id))
  ));

create policy demo_payments_donor_read on public.demo_payments
  for select using (donor_user_id = auth.uid());

create policy demo_payments_organization_read on public.demo_payments
  for select using (exists (
    select 1 from public.pledges pledge
    where pledge.id = demo_payments.pledge_id and public.is_organization_member(pledge.organization_id)
  ));

create policy demo_receipts_donor_read on public.demo_receipts
  for select using (exists (
    select 1 from public.pledges pledge
    where pledge.id = demo_receipts.pledge_id and pledge.donor_user_id = auth.uid()
  ));

create policy demo_receipts_organization_read on public.demo_receipts
  for select using (exists (
    select 1 from public.pledges pledge
    where pledge.id = demo_receipts.pledge_id and public.is_organization_member(pledge.organization_id)
  ));

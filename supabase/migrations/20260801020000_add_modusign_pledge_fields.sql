alter table public.pledges
  add column if not exists anonymous_requested boolean not null default false,
  add column if not exists donation_kind text check (donation_kind in ('cash', 'other')),
  add column if not exists donation_kind_other text,
  add column if not exists donation_designation text check (donation_designation in ('designated', 'undesignated')),
  add column if not exists payment_schedule text check (payment_schedule in ('lump_sum', 'other')),
  add column if not exists payment_method text check (payment_method in ('online', 'direct', 'other')),
  add column if not exists personal_info_consent boolean,
  add column if not exists third_party_info_consent boolean,
  add column if not exists identity_info_consent boolean;

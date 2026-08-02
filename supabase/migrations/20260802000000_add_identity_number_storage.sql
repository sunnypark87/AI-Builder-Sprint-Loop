alter table public.pledges
  add column if not exists donor_identity_number_ciphertext text,
  add column if not exists donor_identity_number_iv text,
  add column if not exists donor_identity_number_auth_tag text,
  add column if not exists donor_identity_number_last4 text,
  add column if not exists donor_identity_number_collected_at timestamptz,
  add column if not exists donor_identity_number_destroyed_at timestamptz;

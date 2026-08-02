alter table public.signature_documents
  add column if not exists sync_started_at timestamptz;

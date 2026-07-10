alter table public.leads
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz;

create index if not exists leads_is_archived_created_at_idx
  on public.leads (is_archived, created_at desc);

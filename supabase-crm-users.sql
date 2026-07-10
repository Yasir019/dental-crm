create extension if not exists "pgcrypto";

create table if not exists public.crm_users (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  username text not null unique,
  display_name text not null default '',
  clinic_name text not null default '',
  email text not null default '',
  phone text not null default '',

  password_salt text not null,
  password_hash text not null
);

create index if not exists idx_crm_users_username
on public.crm_users (username);

insert into public.crm_users (
  username,
  display_name,
  clinic_name,
  email,
  phone,
  password_salt,
  password_hash
)
values (
  'Dental',
  'Dental Admin',
  'Pearl Dental Studio',
  '',
  '',
  'dental-crm-default-salt-2026',
  '7b09a7f8dd816724a19819a4528c9ace297c490921975f44cdf81c33e2f09aeb'
)
on conflict (username) do nothing;

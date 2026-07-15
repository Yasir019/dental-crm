create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  patient_name text not null,
  patient_email text not null default '',
  patient_phone text not null,
  service text not null,
  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,
  timezone text not null default 'Asia/Karachi',
  status text not null default 'Scheduled',
  source text not null default 'Manual',
  retell_call_id text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_time_check check (scheduled_end > scheduled_start),
  constraint appointments_status_check check (
    status in ('Scheduled', 'Completed', 'Cancelled', 'No Show')
  ),
  constraint appointments_source_check check (
    source in ('AI Callback', 'AI Voice Agent', 'Manual')
  )
);

create index if not exists appointments_scheduled_start_idx
  on public.appointments (scheduled_start);

create index if not exists appointments_lead_id_idx
  on public.appointments (lead_id);

create index if not exists appointments_status_idx
  on public.appointments (status);

alter table public.appointments enable row level security;

drop trigger if exists set_appointments_updated_at on public.appointments;
create trigger set_appointments_updated_at
before update on public.appointments
for each row execute function public.set_updated_at();

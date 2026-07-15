begin;

alter table public.leads
  drop constraint if exists leads_followup_check;

alter table public.leads
  add constraint leads_followup_check check (
    followup in (
      'Pending',
      'Email Sent',
      'Callback Started',
      'Email & Callback',
      'No Followup Needed'
    )
  );

create table if not exists public.crm_followup_settings (
  id smallint primary key default 1 check (id = 1),
  automatic_email_enabled boolean not null default false,
  automatic_callback_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.crm_followup_settings (id)
values (1)
on conflict (id) do nothing;

create table if not exists public.lead_followup_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  channel text not null check (channel in ('email', 'callback')),
  mode text not null check (mode in ('automatic', 'manual')),
  status text not null check (status in ('queued', 'sent', 'initiated', 'failed')),
  subject text not null default '',
  body text not null default '',
  provider_reference text not null default '',
  error_message text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists lead_followup_activities_lead_id_idx
  on public.lead_followup_activities (lead_id, created_at desc);

create index if not exists lead_followup_activities_channel_status_idx
  on public.lead_followup_activities (channel, status);

alter table public.crm_followup_settings enable row level security;
alter table public.lead_followup_activities enable row level security;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_crm_followup_settings_updated_at
  on public.crm_followup_settings;

create trigger set_crm_followup_settings_updated_at
before update on public.crm_followup_settings
for each row execute function public.set_updated_at();

commit;

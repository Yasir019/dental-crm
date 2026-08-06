create extension if not exists "pgcrypto";

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  name text not null,
  phone text not null,
  email text not null,
  service text not null,
  followup text not null default 'Pending',
  status text not null default 'Pending',
  source text not null default 'Website Form',
  source_detail text not null default '',
  notes text not null default '',

  is_archived boolean not null default false,
  archived_at timestamptz,

  constraint leads_status_check check (
    status in ('Pending', 'Qualified', 'Not Qualified')
  ),
  constraint leads_followup_check check (
    followup in ('Pending', 'Email Sent', 'Callback Started', 'Email & Callback', 'No Followup Needed')
  ),
  constraint leads_source_check check (
    source in (
      'Website Form',
      'Google Form',
      'AI Voice Agent',
      'AI Chatbot',
      'Website Chatbot',
      'Manual Entry'
    )
  )
);

create index if not exists leads_created_at_idx
  on public.leads (created_at desc);

create index if not exists leads_status_idx
  on public.leads (status);

create index if not exists leads_followup_idx
  on public.leads (followup);

create index if not exists leads_source_idx
  on public.leads (source);

create index if not exists leads_is_archived_created_at_idx
  on public.leads (is_archived, created_at desc);

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
  'BrightSmile Dental Center',
  '',
  '',
  'dental-crm-default-salt-2026',
  '7b09a7f8dd816724a19819a4528c9ace297c490921975f44cdf81c33e2f09aeb'
)
on conflict (username) do nothing;

create table if not exists public.lead_chat_messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  session_id text,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  message_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists lead_chat_messages_lead_id_idx
  on public.lead_chat_messages (lead_id, message_order, created_at);

create index if not exists lead_chat_messages_session_id_idx
  on public.lead_chat_messages (session_id);

create table if not exists public.lead_voice_calls (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  retell_call_id text unique,
  phone_number text not null default '',
  from_number text not null default '',
  to_number text not null default '',
  call_status text not null default '',
  call_summary text not null default '',
  transcript text not null default '',
  recording_url text not null default '',
  user_sentiment text not null default '',
  call_successful boolean,
  custom_analysis_data jsonb not null default '{}'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  created_at timestamptz not null default now()
);

create index if not exists lead_voice_calls_lead_id_idx
  on public.lead_voice_calls (lead_id);

create index if not exists lead_voice_calls_retell_call_id_idx
  on public.lead_voice_calls (retell_call_id);

create index if not exists lead_voice_calls_created_at_idx
  on public.lead_voice_calls (created_at desc);

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
    source in ('AI Callback', 'AI Voice Agent', 'AI Chatbot', 'Manual')
  )
);

create index if not exists appointments_scheduled_start_idx
  on public.appointments (scheduled_start);

create index if not exists appointments_lead_id_idx
  on public.appointments (lead_id);

create index if not exists appointments_status_idx
  on public.appointments (status);

alter table public.crm_followup_settings enable row level security;
alter table public.lead_followup_activities enable row level security;
alter table public.appointments enable row level security;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_leads_updated_at on public.leads;
create trigger set_leads_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

drop trigger if exists set_crm_users_updated_at on public.crm_users;
create trigger set_crm_users_updated_at
before update on public.crm_users
for each row execute function public.set_updated_at();

drop trigger if exists set_crm_followup_settings_updated_at on public.crm_followup_settings;
create trigger set_crm_followup_settings_updated_at
before update on public.crm_followup_settings
for each row execute function public.set_updated_at();

drop trigger if exists set_appointments_updated_at on public.appointments;
create trigger set_appointments_updated_at
before update on public.appointments
for each row execute function public.set_updated_at();

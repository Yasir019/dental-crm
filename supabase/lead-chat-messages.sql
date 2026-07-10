create extension if not exists pgcrypto;

drop table if exists public.chatbot_messages;
drop table if exists public.chatbot_conversations;
drop table if exists public.chatbot_context;

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

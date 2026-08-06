-- Run once on an existing Supabase project.
-- Allows chatbot-created appointments to be identified separately in the CRM.
alter table public.appointments
  drop constraint if exists appointments_source_check;

alter table public.appointments
  add constraint appointments_source_check
  check (source in ('AI Callback', 'AI Voice Agent', 'AI Chatbot', 'Manual'));

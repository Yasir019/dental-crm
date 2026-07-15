# Supabase SQL

Run these files in the Supabase SQL editor when setting up or updating the production database.

For a fresh Supabase project, run:

1. `full-schema.sql`

For an existing database, run only the migration-style files you need.

Suggested order:

1. `crm-users.sql`
2. `fix-leads-source-check.sql`
3. `lead-chat-messages.sql`
4. `lead-archive.sql`
5. `lead-voice-calls.sql`
6. `lead-followup-automation.sql`
7. `appointments.sql`

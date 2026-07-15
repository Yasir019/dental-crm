# DentalLead CRM Requirements

## Project Goal

Build DentalLead CRM into a SaaS-level dental lead management system for clinics. The CRM should capture leads from multiple sources, track follow-ups, support AI-assisted communication, and eventually support scalable storage and multi-clinic usage.

## Current Product Scope

The current MVP includes:

- Public website lead form
- Supabase database
- CRM dashboard
- Leads management page
- Follow-up page
- AI email template generation
- Email sending with Resend
- Automatic email attempt after form submission
- Lead source tracking

## Current Lead Sources

The system should support these lead capture sources:

1. Website Form
2. Google Form
3. AI Voice Agent
4. AI Chatbot

Website and manual leads use the normal lead endpoint:

```text
POST /api/leads/create
```

External sources use protected integration endpoints:

```text
POST /api/integrations/google-form
POST /api/integrations/chatbot/lead
POST /api/integrations/voice-agent/lead
```

Example payload:

```json
{
  "name": "Patient Name",
  "phone": "03001234567",
  "email": "patient@email.com",
  "service": "Dental Implants",
  "source": "AI Voice Agent",
  "sourceDetail": "Retell inbound call via Twilio",
  "notes": "Call summary from AI agent"
}
```

## Website Form Requirements

The website form should capture:

- Name
- Phone
- Email
- Service

Default source values:

```json
{
  "source": "Website Form",
  "sourceDetail": "Public website inquiry form"
}
```

## Google Form Requirements

Google Form integration should use Google Apps Script or a webhook bridge.

Flow:

```text
Google Form submission
-> Google Apps Script
-> POST /api/integrations/google-form
-> CRM database
```

Google Form should send:

- Name
- Phone
- Email
- Service
- Source: `Google Form`
- Source detail: `Google Form submission`
- Optional notes from extra form answers

Google Form requests should include:

```text
x-integration-key: INTEGRATION_API_KEY
```

## AI Voice Agent Requirements

AI Voice Agent should work with:

- Twilio phone number
- Retell AI voice agent

Expected flow:

```text
Patient calls dental clinic Twilio number
-> Retell AI agent answers
-> Agent captures name, phone, email, service
-> Agent creates call summary
-> Retell webhook sends call analysis to existing n8n workflow voice branch
-> n8n AI Agent extracts structured lead with Groq openai/gpt-oss-120b
-> n8n posts completed lead to CRM voice integration endpoint
-> CRM stores lead with source AI Voice Agent
```

AI Voice Agent should capture:

- Patient name
- Phone
- Email
- Interested service
- Call summary / notes
- Recording URL
- Transcript

Voice leads must not be saved if the caller does not provide an email address.

Default source values:

```json
{
  "source": "AI Voice Agent",
  "sourceDetail": "Retell AI voice agent via n8n"
}
```

Voice call metadata is stored in `lead_voice_calls`, linked to the created lead.

## Future AI Voice Agent Settings Page

Add a dedicated settings page for AI Voice Agent.

Required UI sections:

- Enable/disable AI Voice Agent
- Twilio phone number
- Retell agent ID
- Retell API key status
- Webhook URL copy button
- Agent prompt preview
- Retell setup checklist
- Test webhook / create test lead button
- Last call received
- Service mapping

Service mapping examples:

```text
implant -> Dental Implants
whitening -> Teeth Whitening
braces -> Braces
root canal -> Root Canal
filling -> Dental Fillings
bonding -> Bonding
```

## Lead Data Model

Current lead fields:

- ID
- Timestamp
- Name
- Phone
- Email
- Service
- Followup
- Status
- Source
- Source detail
- Notes

Voice lead detail fields:

- Retell call ID
- Recording URL
- Transcript
- Call summary
- Call status
- Caller/from number
- Clinic/to number
- Duration
- Sentiment
- Raw webhook payload

## AI Chatbot Source Requirements

Current implementation direction:

- Website chatbot widget sends visitor messages to FastAPI.
- FastAPI forwards messages to an n8n webhook.
- n8n uses an AI Agent, Groq model, memory, structured parser, and website context written directly into the agent prompt.
- When name, phone, email, and service are complete, n8n creates a CRM lead through the protected chatbot integration endpoint.
- The backend stores the completed lead transcript in `lead_chat_messages`, linked directly to the created lead.

Recommended n8n flow:

```text
Website Chatbot
-> POST /api/chatbot/message
-> n8n Webhook
-> AI Agent with static website context prompt
-> Groq model openai/gpt-oss-120b
-> Structured lead parser
-> If lead fields complete
-> POST /api/integrations/chatbot/lead
-> Store transcript in lead_chat_messages
-> Return reply to website
```

Current RAG approach:

- No RAG/vector search is required for the first version because the website context is small.
- Keep website facts directly in the n8n AI Agent prompt for now.
- Future SaaS version can add Supabase pgvector and embeddings per clinic.

Recommended future fields:

- Lead score
- Intent
- Campaign
- Assigned staff member
- Last contacted at
- Next follow-up date
- Appointment date
- Activity timeline

## CRM Pages

Current pages:

- Public Lead Form
- Staff Login
- Dashboard
- Leads
- Followup
- Sources
- Settings

Leads navigation should expose source-specific pages under Leads:

- Website Form
- Google Form
- AI Chatbot
- AI Voice

Because lead sources are separate pages, remove the source dropdown from the Leads filters. AI Voice leads need recording and transcript/detail buttons.

Future pages:

- AI Voice Agent Settings
- Clinic Settings
- Lead Detail
- Notes and Activity Timeline
- Appointments
- Team Members
- Billing / Subscription

## Dashboard Requirements

Current dashboard should show:

- Total Leads
- Today Leads
- Qualified Leads
- Not Qualified Leads
- AI Voice Leads
- Leads by Service chart
- Leads by Source chart
- Qualified vs Not Qualified chart

Future dashboard should show:

- Conversion rate
- Leads by campaign
- Leads by staff member
- Booked appointments
- Revenue estimate
- Source performance

## Follow-up Requirements

Current:

- Show pending follow-up leads
- Generate AI email template
- Send email
- Mark email sent
- Automatic email attempt after form submission

Future:

- Follow-up reminders
- SMS/WhatsApp follow-up
- Automated follow-up sequences
- Email template management
- Call follow-up status

## Email Requirements

Current provider:

- Resend

Required environment variables:

```env
EMAIL_API_KEY=
EMAIL_FROM=
```

AI key is optional:

```env
AI_API_KEY=
```

If `AI_API_KEY` is missing, backend should use a safe built-in follow-up email template.

## Database Requirements

Current database:

- Supabase Postgres

### Appointment booking

- CRM callbacks use the Retell voice agent to book a dental appointment with the lead.
- Clinic timezone is `Asia/Karachi`.
- Clinic hours are Monday to Friday, 9:00 AM to 5:00 PM.
- Saturday and Sunday are closed and cannot be booked.
- Standard appointment duration is 30 minutes.
- The agent must confirm the requested date and time before booking.
- The agent must not claim a booking is confirmed until the CRM booking API succeeds.
- Conflicting, past, weekend, and outside-hours appointments must be rejected.
- Confirmed bookings are stored in Supabase and displayed on the CRM Calendar page.
- CRM staff can add appointments manually and mark them Scheduled, Completed, Cancelled, or No Show.

## Backend Architecture

Current backend:

- Python FastAPI
- Supabase REST API through backend-only service role key
- Modular folder structure:
  - `app/api/routes` for API route files
  - `app/core` for settings and auth security helpers
  - `app/db` for Supabase client/request code
  - `app/schemas` for Pydantic request models
  - `app/services` for business logic
  - `app/utils` for validation helpers

Important future decision:

Google Sheets may be added later as an optional export or sync integration.

Recommended SaaS path:

- Use Supabase for production SaaS.
- Keep Google Sheets as optional export/sync integration, not the primary database.

Reasons Supabase is better for SaaS:

- Authentication
- Row-level security
- Multi-clinic support
- Relational data
- Realtime features
- Storage
- Easier scaling

Google Sheets can still be useful for:

- Simple clinic export
- Backup
- No-code reporting
- Google Form sync

## SaaS Roadmap

Recommended feature order:

1. Admin login/auth
2. Lead detail page
3. Notes and activity timeline
4. Appointment booking status
5. Source tracking polish
6. AI Voice Agent Settings page
7. Google Form integration instructions/tools
8. WhatsApp/SMS follow-up
9. Multi-clinic support
10. Multi-clinic Supabase schema
11. Stripe subscriptions
12. Role-based access

## Important Notes

- Do not expose API keys in frontend.
- Retell and Twilio setup mostly happens in their dashboards.
- CRM should expose a webhook/API endpoint for Retell to create leads.
- Failed automatic email should never block lead creation.
- Leads from all sources should appear in Dashboard.
- Lead source pages should separate Website Form, Google Form, AI Chatbot, and AI Voice leads.

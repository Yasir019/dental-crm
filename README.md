# DentalLead CRM

DentalLead CRM is a full-stack dental lead management MVP with a public inquiry form, Supabase storage, dashboard analytics, lead qualification, follow-up tracking, AI-generated email templates, and email sending.

## Tech Stack

- Frontend: React, Vite, Tailwind CSS, Recharts, Lucide React
- Backend: Python, FastAPI, Supabase, OpenAI-compatible AI call, Resend email API
- Storage: Supabase Postgres

## Project Structure

```text
dental-lead-crm/
  frontend/
    src/
      components/
      pages/
      layouts/
      services/
      utils/
      styles/
  backend/
    app/
      api/
        routes/
      core/
      db/
      schemas/
      services/
      utils/
    main.py
    requirements.txt
  README.md
  .env.example
```

## Supabase Setup

Create a Supabase project and run the `leads` table SQL in the Supabase SQL editor before starting the backend.
Also run `supabase-crm-users.sql` to create the CRM login table and default user.
The current chatbot uses static website context in the n8n AI Agent prompt. Run `supabase-lead-chat-messages.sql` if you want each captured AI chatbot lead to store its chat transcript in a separate `lead_chat_messages` table.
If Supabase rejects chatbot leads with `leads_source_check`, run `supabase-fix-leads-source-check.sql` to allow the `AI Chatbot` source.

## Environment Variables

Copy `.env.example` into `backend/.env` and fill in the values:

```bash
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
INTEGRATION_API_KEY=
AI_API_KEY=
EMAIL_API_KEY=
EMAIL_FROM=
PORT=5000
FRONTEND_URL=http://localhost:5173
```

Keep `SUPABASE_SERVICE_ROLE_KEY` only in `backend/.env`. Never expose it in frontend code.

For automatic emails after form submission, set:

```bash
EMAIL_API_KEY=your_resend_api_key
EMAIL_FROM=Your Clinic <verified@yourdomain.com>
```

`EMAIL_FROM` must be a sender/domain verified in Resend. `AI_API_KEY` is optional; if it is missing, the backend sends a built-in safe follow-up template.

Optional frontend override:

```bash
VITE_API_BASE_URL=http://localhost:5000/api
```

For the n8n AI chatbot source:

```bash
N8N_CHATBOT_WEBHOOK_URL=your_n8n_webhook_url
N8N_CHATBOT_SECRET=change-this-chatbot-secret
```

## Install

Install both apps:

```bash
npm run install:all
```

Or install separately:

```bash
cd backend
python -m pip install -r requirements.txt

cd ../frontend
npm install
```

## Run Locally

Backend:

```bash
cd backend
python -m uvicorn main:app --host 127.0.0.1 --port 5000 --reload
```

Frontend:

```bash
cd frontend
npm run dev
```

Open the frontend at:

```text
http://localhost:5173
```

The public lead form is the first screen. Use the floating `Open CRM` button to access the dashboard, leads, and follow-up pages.

## API Endpoints

- `POST /api/leads/create`: create a lead with default `Followup` and `Status` as `Pending`
- `GET /api/leads`: fetch all leads
- `PATCH /api/leads/status`: update lead status
- `PATCH /api/leads/followup`: update follow-up status
- `POST /api/ai/generate-template`: generate email subject and body
- `POST /api/email/send`: send an email
- `POST /api/chatbot/message`: send website chatbot messages to the n8n AI workflow
- `GET /api/integrations/chatbot/context`: protected context endpoint for n8n
- `POST /api/integrations/chatbot/lead`: protected lead creation endpoint for n8n chatbot

## Notes

- Keep all API keys in `backend/.env`; the frontend never receives backend secrets.
- Lead data is stored in Supabase.
- If `AI_API_KEY` is missing, the backend returns a safe built-in follow-up template.
- Email sending uses Resend. Set `EMAIL_API_KEY` and `EMAIL_FROM` before using automatic emails or Send Email.

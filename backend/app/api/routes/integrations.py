from fastapi import APIRouter, BackgroundTasks, Header, HTTPException
from app.core.config import settings
from app.schemas.chatbot import ChatbotLeadCreate
from app.schemas.leads import LeadCreate
from app.schemas.voice import VoiceLeadCreate
from app.schemas.followups import AutomaticLeadCallbackRequest, AutomaticLeadEmailRequest, EmailDeliveryStatusRequest
from app.services.followup_service import dispatch_automatic_followup, record_lead_email_delivery, send_lead_email, start_lead_callback
from app.services.leads_service import create_lead, create_lead_chat_messages, create_lead_voice_call
from app.utils.validation import validate_lead

router = APIRouter(prefix="/api/integrations", tags=["integrations"])


def get_retell_call_metadata(raw_payload: dict | None) -> dict:
    queue = [raw_payload or {}]
    visited: set[int] = set()

    while queue:
        payload = queue.pop(0)
        if not isinstance(payload, dict) or id(payload) in visited:
            continue
        visited.add(id(payload))

        metadata = payload.get("metadata")
        if isinstance(metadata, dict):
            return metadata

        queue.extend(payload.get(key) for key in ("body", "data", "call") if isinstance(payload.get(key), dict))

    return {}


@router.post("/google-form", status_code=201)
async def google_form_handler(payload: LeadCreate, background_tasks: BackgroundTasks, x_integration_key: str | None = Header(default=None)):
    if not settings.integration_api_key:
        raise HTTPException(status_code=500, detail={"message": "Integration API key is not configured."})
    if x_integration_key != settings.integration_api_key:
        raise HTTPException(status_code=401, detail={"message": "Invalid integration key."})

    data = payload.model_dump()
    data["source"] = "Google Form"
    data["sourceDetail"] = data.get("sourceDetail") or "Google Form submission"
    validate_lead(data)
    lead = await create_lead(data)
    background_tasks.add_task(dispatch_automatic_followup, lead)
    return {"message": "Google Form lead created successfully.", "lead": lead}


def require_integration_key(x_integration_key: str | None):
    if not settings.integration_api_key:
        raise HTTPException(status_code=500, detail={"message": "Integration API key is not configured."})
    if x_integration_key != settings.integration_api_key:
        raise HTTPException(status_code=401, detail={"message": "Invalid integration key."})


@router.post("/chatbot/lead", status_code=201)
async def chatbot_lead_handler(payload: ChatbotLeadCreate, background_tasks: BackgroundTasks, x_integration_key: str | None = Header(default=None)):
    require_integration_key(x_integration_key)

    transcript = "\n".join([f"{message.role}: {message.content}" for message in payload.transcript[-12:]])
    notes = payload.notes or ""
    if transcript:
        notes = f"{notes}\n\nChat transcript:\n{transcript}".strip()

    data = {
        "name": payload.name,
        "phone": payload.phone,
        "email": payload.email,
        "service": payload.service,
        "source": "AI Chatbot",
        "sourceDetail": "Website AI chatbot via n8n",
        "notes": notes,
    }
    validate_lead(data)
    lead = await create_lead(data)
    chat_messages = await create_lead_chat_messages(
        lead["id"],
        [message.model_dump() for message in payload.transcript],
        payload.sessionId,
    )
    background_tasks.add_task(dispatch_automatic_followup, lead)
    return {"message": "AI chatbot lead created successfully.", "lead": lead, "chatMessages": chat_messages}


@router.post("/voice-agent/lead", status_code=201)
async def voice_agent_lead_handler(payload: VoiceLeadCreate, background_tasks: BackgroundTasks, x_integration_key: str | None = Header(default=None)):
    require_integration_key(x_integration_key)

    metadata = get_retell_call_metadata(payload.rawPayload)
    if (
        metadata.get("call_purpose") == "appointment_booking_callback"
        or metadata.get("source") == "crm_followup_callback"
    ):
        return {
            "message": "Outbound appointment callback analyzed; no duplicate voice lead created.",
            "skipped": True,
            "leadId": metadata.get("lead_id"),
        }

    notes_parts = [payload.notes or ""]
    if payload.callSummary:
        notes_parts.append(f"Call summary:\n{payload.callSummary}")
    if payload.transcript:
        notes_parts.append(f"Voice transcript:\n{payload.transcript}")

    data = {
        "name": payload.name,
        "phone": payload.phone,
        "email": payload.email,
        "service": payload.service,
        "source": "AI Voice Agent",
        "sourceDetail": "Retell AI voice agent via n8n",
        "notes": "\n\n".join([part for part in notes_parts if part]).strip(),
    }
    validate_lead(data)
    lead = await create_lead(data)
    voice_call = await create_lead_voice_call(lead["id"], payload.model_dump())
    background_tasks.add_task(dispatch_automatic_followup, lead)
    return {"message": "AI voice lead created successfully.", "lead": lead, "voiceCall": voice_call}


@router.post("/followup/email")
async def automatic_followup_email_handler(payload: AutomaticLeadEmailRequest, x_integration_key: str | None = Header(default=None)):
    require_integration_key(x_integration_key)
    mode = payload.mode if payload.mode in ["automatic", "manual"] else "automatic"
    result = await send_lead_email(payload.leadId, payload.subject, payload.body, mode)
    return {"message": f"{mode.capitalize()} email sent.", **result}


@router.post("/followup/email/status")
async def followup_email_status_handler(payload: EmailDeliveryStatusRequest, x_integration_key: str | None = Header(default=None)):
    require_integration_key(x_integration_key)
    mode = payload.mode if payload.mode in ["automatic", "manual"] else "automatic"
    result = await record_lead_email_delivery(
        payload.leadId,
        payload.subject,
        payload.body,
        mode,
        payload.status,
        payload.providerReference,
        payload.errorMessage,
    )
    return {"message": f"Gmail delivery recorded as {payload.status}.", **result}


@router.post("/followup/callback")
async def automatic_followup_callback_handler(payload: AutomaticLeadCallbackRequest, x_integration_key: str | None = Header(default=None)):
    require_integration_key(x_integration_key)
    mode = payload.mode if payload.mode in ["automatic", "manual"] else "automatic"
    result = await start_lead_callback(payload.leadId, mode)
    return {"message": f"{mode.capitalize()} AI callback started.", **result}

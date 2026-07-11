from fastapi import APIRouter, Header, HTTPException
from app.core.config import settings
from app.schemas.chatbot import ChatbotLeadCreate
from app.schemas.leads import LeadCreate
from app.schemas.voice import VoiceLeadCreate
from app.services.leads_service import create_lead, create_lead_chat_messages, create_lead_voice_call
from app.utils.validation import validate_lead

router = APIRouter(prefix="/api/integrations", tags=["integrations"])


@router.post("/google-form", status_code=201)
async def google_form_handler(payload: LeadCreate, x_integration_key: str | None = Header(default=None)):
    if not settings.integration_api_key:
        raise HTTPException(status_code=500, detail={"message": "Integration API key is not configured."})
    if x_integration_key != settings.integration_api_key:
        raise HTTPException(status_code=401, detail={"message": "Invalid integration key."})

    data = payload.model_dump()
    data["source"] = "Google Form"
    data["sourceDetail"] = data.get("sourceDetail") or "Google Form submission"
    validate_lead(data)
    lead = await create_lead(data)
    return {"message": "Google Form lead created successfully.", "lead": lead}


def require_integration_key(x_integration_key: str | None):
    if not settings.integration_api_key:
        raise HTTPException(status_code=500, detail={"message": "Integration API key is not configured."})
    if x_integration_key != settings.integration_api_key:
        raise HTTPException(status_code=401, detail={"message": "Invalid integration key."})


@router.post("/chatbot/lead", status_code=201)
async def chatbot_lead_handler(payload: ChatbotLeadCreate, x_integration_key: str | None = Header(default=None)):
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
    return {"message": "AI chatbot lead created successfully.", "lead": lead, "chatMessages": chat_messages}


@router.post("/voice-agent/lead", status_code=201)
async def voice_agent_lead_handler(payload: VoiceLeadCreate, x_integration_key: str | None = Header(default=None)):
    require_integration_key(x_integration_key)

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
    return {"message": "AI voice lead created successfully.", "lead": lead, "voiceCall": voice_call}

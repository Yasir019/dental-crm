import json
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException
from app.core.config import settings
from app.schemas.chatbot import ChatbotLeadCreate
from app.schemas.leads import LeadCreate
from app.schemas.voice import FollowupVoiceCallCreate, VoiceLeadCreate
from app.schemas.followups import AutomaticLeadCallbackRequest, AutomaticLeadEmailRequest, EmailDeliveryStatusRequest
from app.services.followup_service import dispatch_automatic_followup, record_lead_email_delivery, send_lead_email, start_lead_callback
from app.services.leads_service import create_lead, create_lead_chat_messages, create_lead_voice_call, get_lead
from app.utils.validation import validate_lead

router = APIRouter(prefix="/api/integrations", tags=["integrations"])


def _as_dict(value: Any) -> dict:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            return {}
    return {}


def normalize_voice_lead_payload(payload: dict) -> dict:
    """Accept flat n8n output as well as an AI Agent lead wrapper."""
    root = _as_dict(payload)
    candidates = [
        root,
        _as_dict(root.get("lead")),
        _as_dict(root.get("data")),
        _as_dict(root.get("analysis")),
        _as_dict(root.get("call_analysis")),
        _as_dict(root.get("response")),
    ]

    def first(*keys: str) -> Any:
        for candidate in candidates:
            for key in keys:
                value = candidate.get(key)
                if value not in (None, "", []):
                    return value
        return ""

    normalized = dict(root)
    normalized.update(
        {
            "name": first("name", "fullName", "customerName", "patientName"),
            "phone": first("phone", "phoneNumber", "customerPhone", "callerPhone"),
            "email": first("email", "emailAddress", "customerEmail", "patientEmail"),
            "service": first("service", "dentalService", "interestedService", "requestedService"),
            "callId": first("callId", "call_id", "retellCallId", "retell_call_id"),
            "callSummary": first("callSummary", "call_summary", "summary"),
            "recordingUrl": first("recordingUrl", "recording_url", "recording"),
            "fromNumber": first("fromNumber", "from_number"),
            "toNumber": first("toNumber", "to_number"),
            "callStatus": first("callStatus", "call_status", "status"),
            "transcript": first("transcript", "conversation"),
            "userSentiment": first("userSentiment", "user_sentiment", "sentiment"),
            "rawPayload": root.get("rawPayload") or root.get("raw_payload") or root,
        }
    )
    return normalized


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
async def voice_agent_lead_handler(payload: dict, background_tasks: BackgroundTasks, x_integration_key: str | None = Header(default=None)):
    require_integration_key(x_integration_key)

    try:
        voice_payload = VoiceLeadCreate.model_validate(normalize_voice_lead_payload(payload))
    except Exception as error:
        raise HTTPException(
            status_code=422,
            detail={"message": "Voice lead payload is incomplete.", "errors": str(error)},
        ) from error

    metadata = get_retell_call_metadata(voice_payload.rawPayload)
    if (
        metadata.get("call_purpose") == "appointment_booking_callback"
        or metadata.get("source") == "crm_followup_callback"
    ):
        return {
            "message": "Outbound appointment callback analyzed; no duplicate voice lead created.",
            "skipped": True,
            "leadId": metadata.get("lead_id"),
        }

    notes_parts = [voice_payload.notes or ""]
    if voice_payload.callSummary:
        notes_parts.append(f"Call summary:\n{voice_payload.callSummary}")
    if voice_payload.transcript:
        notes_parts.append(f"Voice transcript:\n{voice_payload.transcript}")

    data = {
        "name": voice_payload.name,
        "phone": voice_payload.phone,
        "email": voice_payload.email,
        "service": voice_payload.service,
        "source": "AI Voice Agent",
        "sourceDetail": "Retell AI voice agent via n8n",
        "notes": "\n\n".join([part for part in notes_parts if part]).strip(),
    }
    validate_lead(data)
    lead = await create_lead(data)
    voice_call = await create_lead_voice_call(lead["id"], voice_payload.model_dump())
    background_tasks.add_task(dispatch_automatic_followup, lead)
    return {"message": "AI voice lead created successfully.", "lead": lead, "voiceCall": voice_call}


@router.post("/voice-agent/followup-call", status_code=201)
async def voice_agent_followup_call_handler(payload: FollowupVoiceCallCreate, x_integration_key: str | None = Header(default=None)):
    require_integration_key(x_integration_key)
    await get_lead(payload.leadId)
    voice_call = await create_lead_voice_call(payload.leadId, payload.model_dump(), "followup")
    return {
        "message": "AI follow-up call details saved successfully.",
        "leadId": payload.leadId,
        "voiceCall": voice_call,
    }


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

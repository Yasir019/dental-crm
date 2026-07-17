from fastapi import APIRouter, BackgroundTasks
from app.schemas.leads import ArchiveUpdate, FollowupUpdate, LeadCreate, LeadUpdate, StatusUpdate
from app.services.followup_service import dispatch_automatic_followup
from app.services.leads_service import archive_lead, create_lead, delete_lead, get_archived_leads, get_lead, get_lead_chat_messages, get_lead_voice_call, get_lead_voice_calls, get_leads, update_lead_details, update_lead_followup, update_lead_status
from app.utils.validation import FOLLOWUP_STATUSES, STATUSES, require_allowed, validate_lead

router = APIRouter(prefix="/api/leads", tags=["leads"])


@router.post("/create", status_code=201)
async def create_lead_handler(payload: LeadCreate, background_tasks: BackgroundTasks):
    data = payload.model_dump()
    validate_lead(data)
    lead = await create_lead(data)
    background_tasks.add_task(dispatch_automatic_followup, lead)
    return {"message": "Lead created successfully.", "lead": lead}


@router.get("")
async def list_leads_handler():
    return {"leads": await get_leads()}


@router.get("/archived")
async def archived_leads_handler():
    return {"leads": await get_archived_leads()}


@router.get("/{lead_id}")
async def lead_detail_handler(lead_id: str):
    return {"lead": await get_lead(lead_id)}


@router.get("/{lead_id}/chat-messages")
async def lead_chat_messages_handler(lead_id: str):
    return {"messages": await get_lead_chat_messages(lead_id)}


@router.get("/{lead_id}/voice-call")
async def lead_voice_call_handler(lead_id: str, callType: str | None = None, callId: str | None = None):
    return {"voiceCall": await get_lead_voice_call(lead_id, callType, callId)}


@router.get("/{lead_id}/voice-calls")
async def lead_voice_calls_handler(lead_id: str, callType: str | None = None):
    return {"voiceCalls": await get_lead_voice_calls(lead_id, callType)}


@router.patch("/status")
async def update_status_handler(payload: StatusUpdate):
    require_allowed(payload.status, STATUSES, "Status")
    lead = await update_lead_status(payload.id, payload.status)
    return {"message": "Lead status updated.", "lead": lead}


@router.patch("/archive")
async def archive_lead_handler(payload: ArchiveUpdate):
    lead = await archive_lead(payload.id, payload.archived)
    return {"message": "Lead archived." if payload.archived else "Lead restored.", "lead": lead}


@router.patch("/followup")
async def update_followup_handler(payload: FollowupUpdate):
    require_allowed(payload.followup, FOLLOWUP_STATUSES, "Followup status")
    lead = await update_lead_followup(payload.id, payload.followup)
    return {"message": "Follow-up status updated.", "lead": lead}


@router.patch("/{lead_id}")
async def update_lead_handler(lead_id: str, payload: LeadUpdate):
    data = payload.model_dump()
    validate_lead(data)
    lead = await update_lead_details(lead_id, data)
    return {"message": "Lead updated.", "lead": lead}


@router.delete("/{lead_id}")
async def delete_lead_handler(lead_id: str):
    lead = await delete_lead(lead_id)
    return {"message": "Lead permanently deleted.", "lead": lead}

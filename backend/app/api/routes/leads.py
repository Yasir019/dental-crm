from fastapi import APIRouter
from app.schemas.leads import ArchiveUpdate, FollowupUpdate, LeadCreate, LeadUpdate, StatusUpdate
from app.services.ai_service import generate_followup_template
from app.services.email_service import send_email
from app.services.leads_service import archive_lead, create_lead, delete_lead, get_archived_leads, get_lead_chat_messages, get_leads, update_lead_details, update_lead_followup, update_lead_status
from app.utils.validation import FOLLOWUP_STATUSES, STATUSES, require_allowed, validate_lead

router = APIRouter(prefix="/api/leads", tags=["leads"])


@router.post("/create", status_code=201)
async def create_lead_handler(payload: LeadCreate):
    data = payload.model_dump()
    validate_lead(data)
    lead = await create_lead(data)
    email_status = {"sent": False, "message": "Automatic email was not sent."}
    saved_lead = lead

    try:
        template = await generate_followup_template(lead["name"], lead["service"])
        await send_email(lead["email"], template["subject"], template["body"])
        saved_lead = await update_lead_followup(lead["id"], "Email Sent")
        email_status = {"sent": True, "message": "Automatic follow-up email sent."}
    except Exception as error:
        print(f"Automatic lead email failed: {error}")
        email_status = {"sent": False, "message": "Lead was saved, but automatic email could not be sent."}

    return {"message": "Lead created successfully.", "lead": saved_lead, "emailStatus": email_status}


@router.get("")
async def list_leads_handler():
    return {"leads": await get_leads()}


@router.get("/archived")
async def archived_leads_handler():
    return {"leads": await get_archived_leads()}


@router.get("/{lead_id}/chat-messages")
async def lead_chat_messages_handler(lead_id: str):
    return {"messages": await get_lead_chat_messages(lead_id)}


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

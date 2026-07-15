from fastapi import APIRouter, Depends

from app.core.security import require_auth
from app.schemas.followups import FollowupSettingsUpdate, LeadEmailRequest
from app.services.followup_service import (
    get_followup_settings,
    get_lead_followup_activities,
    queue_lead_callback,
    queue_lead_email,
    update_followup_settings,
)

router = APIRouter(prefix="/api/followups", tags=["followups"])


@router.get("/settings")
async def followup_settings_handler(user=Depends(require_auth)):
    return {"settings": await get_followup_settings()}


@router.patch("/settings")
async def update_followup_settings_handler(payload: FollowupSettingsUpdate, user=Depends(require_auth)):
    saved = await update_followup_settings(payload.model_dump())
    return {"message": "Follow-up automation settings saved.", "settings": saved}


@router.get("/leads/{lead_id}/activities")
async def lead_followup_activities_handler(lead_id: str, user=Depends(require_auth)):
    return {"activities": await get_lead_followup_activities(lead_id)}


@router.post("/leads/{lead_id}/email")
async def manual_lead_email_handler(lead_id: str, payload: LeadEmailRequest, user=Depends(require_auth)):
    result = await queue_lead_email(lead_id, payload.subject, payload.body, "manual")
    return {"message": "Email sent through the n8n workflow.", **result}


@router.post("/leads/{lead_id}/callback")
async def manual_lead_callback_handler(lead_id: str, user=Depends(require_auth)):
    result = await queue_lead_callback(lead_id, "manual")
    return {"message": "AI callback started through the n8n workflow.", **result}

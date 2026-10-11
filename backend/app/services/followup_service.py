from fastapi import HTTPException

from app.core.config import settings
from app.db.supabase import supabase_request
from app.services.email_service import email_is_configured, send_followup_email
from app.services.leads_service import get_lead, update_lead_followup
from app.services.retell_service import create_retell_phone_call
from app.services.utils import pick_first
from app.workflows.email_graph import run_email_followup


SETTINGS_SELECT = "id,automatic_email_enabled,automatic_callback_enabled,updated_at"
ACTIVITY_SELECT = "id,lead_id,channel,mode,status,subject,body,provider_reference,error_message,created_at"


def normalize_settings(row: dict):
    return {
        "automaticEmailEnabled": bool(row.get("automatic_email_enabled")),
        "automaticCallbackEnabled": bool(row.get("automatic_callback_enabled")),
        "emailConfigured": email_is_configured(),
        "callbackConfigured": bool(settings.retell_api_key and settings.retell_callback_agent_id and settings.retell_phone_number),
        # The follow-up workflows run in-process (LangGraph), so there is nothing external to configure.
        "workflowConfigured": True,
        "updatedAt": row.get("updated_at"),
    }


def normalize_activity(row: dict):
    return {
        "id": row["id"],
        "leadId": row["lead_id"],
        "channel": row["channel"],
        "mode": row["mode"],
        "status": row["status"],
        "subject": row.get("subject") or "",
        "body": row.get("body") or "",
        "providerReference": row.get("provider_reference") or "",
        "errorMessage": row.get("error_message") or "",
        "createdAt": row["created_at"],
    }


async def get_followup_settings():
    rows = await supabase_request(
        "GET",
        "/crm_followup_settings",
        params={"select": SETTINGS_SELECT, "id": "eq.1", "limit": "1"},
    )
    return normalize_settings(pick_first(rows, "Follow-up settings not found."))


async def update_followup_settings(data: dict):
    if data["automaticCallbackEnabled"] and not (settings.retell_api_key and settings.retell_callback_agent_id and settings.retell_phone_number):
        raise HTTPException(status_code=400, detail={"message": "Configure Retell API key, agent, and phone number before enabling automatic callback."})
    if data["automaticEmailEnabled"] and not email_is_configured():
        raise HTTPException(status_code=400, detail={"message": "Configure GMAIL_USER and GMAIL_APP_PASSWORD (or EMAIL_API_KEY and EMAIL_FROM) before enabling automatic email."})

    rows = await supabase_request(
        "PATCH",
        "/crm_followup_settings",
        params={"id": "eq.1", "select": SETTINGS_SELECT},
        json={
            "automatic_email_enabled": data["automaticEmailEnabled"],
            "automatic_callback_enabled": data["automaticCallbackEnabled"],
        },
    )
    return normalize_settings(pick_first(rows, "Follow-up settings could not be updated."))


async def get_lead_followup_activities(lead_id: str):
    rows = await supabase_request(
        "GET",
        "/lead_followup_activities",
        params={"select": ACTIVITY_SELECT, "lead_id": f"eq.{lead_id}", "order": "created_at.desc"},
    )
    return [normalize_activity(row) for row in (rows or [])]


async def create_activity(lead_id: str, channel: str, mode: str, subject: str = "", body: str = ""):
    rows = await supabase_request(
        "POST",
        "/lead_followup_activities",
        params={"select": ACTIVITY_SELECT},
        json={
            "lead_id": lead_id,
            "channel": channel,
            "mode": mode,
            "status": "queued",
            "subject": subject,
            "body": body,
        },
    )
    return normalize_activity(pick_first(rows, "Follow-up activity could not be created."))


async def update_activity(activity_id: str, status: str, provider_reference: str = "", error_message: str = ""):
    rows = await supabase_request(
        "PATCH",
        "/lead_followup_activities",
        params={"id": f"eq.{activity_id}", "select": ACTIVITY_SELECT},
        json={"status": status, "provider_reference": provider_reference, "error_message": error_message},
    )
    return normalize_activity(pick_first(rows, "Follow-up activity could not be updated."))


async def refresh_lead_followup_status(lead_id: str):
    rows = await supabase_request(
        "GET",
        "/lead_followup_activities",
        params={
            "select": "channel",
            "lead_id": f"eq.{lead_id}",
            "status": "in.(sent,initiated)",
        },
    )
    channels = {row["channel"] for row in (rows or [])}
    if channels == {"email", "callback"}:
        next_status = "Email & Callback"
    elif "email" in channels:
        next_status = "Email Sent"
    elif "callback" in channels:
        next_status = "Callback Started"
    else:
        next_status = "Pending"
    return await update_lead_followup(lead_id, next_status)


async def send_lead_email(lead_id: str, subject: str, body: str, mode: str):
    lead = await get_lead(lead_id)
    if not subject.strip() or not body.strip():
        raise HTTPException(status_code=400, detail={"message": "Email subject and body are required."})
    activity = await create_activity(lead_id, "email", mode, subject.strip(), body.strip())
    try:
        result = await send_followup_email(lead["email"], subject.strip(), body.strip())
        reference = result.get("id") or ""
        activity = await update_activity(activity["id"], "sent", reference)
        lead = await refresh_lead_followup_status(lead_id)
        return {"lead": lead, "activity": activity}
    except Exception as error:
        await update_activity(activity["id"], "failed", error_message=str(error))
        raise


async def record_lead_email_delivery(
    lead_id: str,
    subject: str,
    body: str,
    mode: str,
    status: str,
    provider_reference: str = "",
    error_message: str = "",
):
    lead = await get_lead(lead_id)
    activity = await create_activity(lead_id, "email", mode, subject.strip(), body.strip())
    activity = await update_activity(
        activity["id"],
        status,
        provider_reference.strip(),
        error_message.strip(),
    )
    if status == "sent":
        lead = await refresh_lead_followup_status(lead_id)
    return {"lead": lead, "activity": activity}


async def start_lead_callback(lead_id: str, mode: str):
    lead = await get_lead(lead_id)
    activity = await create_activity(lead_id, "callback", mode)
    try:
        result = await create_retell_phone_call(lead)
        activity = await update_activity(activity["id"], "initiated", result.get("callId") or "")
        lead = await refresh_lead_followup_status(lead_id)
        return {"lead": lead, "activity": activity, "call": result}
    except Exception as error:
        await update_activity(activity["id"], "failed", error_message=str(error))
        raise


async def queue_lead_email(lead_id: str, subject: str, body: str, mode: str):
    lead = await get_lead(lead_id)
    return await run_email_followup(
        {
            "leadId": lead_id,
            "name": lead["name"],
            "email": lead["email"],
            "service": lead["service"],
            "subject": subject,
            "body": body,
            "mode": mode,
        }
    )


async def queue_lead_callback(lead_id: str, mode: str):
    return await start_lead_callback(lead_id, mode)


async def dispatch_automatic_followup(lead: dict):
    try:
        followup_settings = await get_followup_settings()
    except Exception as error:
        print(f"Automatic follow-up settings could not be loaded: {error}")
        return
    if not followup_settings["automaticEmailEnabled"] and not followup_settings["automaticCallbackEnabled"]:
        return
    if followup_settings["automaticEmailEnabled"]:
        try:
            await queue_lead_email(lead["id"], "", "", "automatic")
        except Exception as error:
            print(f"Automatic email workflow failed: {error}")
    if followup_settings["automaticCallbackEnabled"]:
        try:
            await queue_lead_callback(lead["id"], "automatic")
        except Exception as error:
            print(f"Automatic callback workflow failed: {error}")

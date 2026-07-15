from datetime import datetime, timezone

from .utils import pick_first
from app.db.supabase import supabase_request


LEAD_SELECT = "id,created_at,name,phone,email,service,followup,status,source,source_detail,notes,is_archived,archived_at"
VOICE_CALL_SELECT = "id,lead_id,retell_call_id,phone_number,from_number,to_number,call_status,call_summary,transcript,recording_url,user_sentiment,call_successful,custom_analysis_data,raw_payload,started_at,ended_at,duration_seconds,created_at"


def normalize_lead(row: dict):
    return {
        "id": row["id"],
        "timestamp": row["created_at"],
        "name": row["name"],
        "phone": row["phone"],
        "email": row["email"],
        "service": row["service"],
        "followup": row["followup"],
        "status": row["status"],
        "source": row.get("source") or "Website Form",
        "sourceDetail": row.get("source_detail") or "",
        "notes": row.get("notes") or "",
        "isArchived": bool(row.get("is_archived")),
        "archivedAt": row.get("archived_at"),
    }


def normalize_voice_call(row: dict | None):
    if not row:
        return None

    return {
        "id": row["id"],
        "leadId": row.get("lead_id"),
        "retellCallId": row.get("retell_call_id"),
        "phoneNumber": row.get("phone_number") or "",
        "fromNumber": row.get("from_number") or "",
        "toNumber": row.get("to_number") or "",
        "callStatus": row.get("call_status") or "",
        "callSummary": row.get("call_summary") or "",
        "transcript": row.get("transcript") or "",
        "recordingUrl": row.get("recording_url") or "",
        "userSentiment": row.get("user_sentiment") or "",
        "callSuccessful": row.get("call_successful"),
        "customAnalysisData": row.get("custom_analysis_data") or {},
        "rawPayload": row.get("raw_payload") or {},
        "startedAt": row.get("started_at"),
        "endedAt": row.get("ended_at"),
        "durationSeconds": row.get("duration_seconds"),
        "createdAt": row.get("created_at"),
    }


def to_database_lead(data: dict):
    return {
        "name": data["name"].strip(),
        "phone": data["phone"].strip(),
        "email": data["email"].strip(),
        "service": data["service"],
        "followup": "Pending",
        "status": "Pending",
        "source": data.get("source") or "Website Form",
        "source_detail": data.get("sourceDetail") or data.get("source_detail") or "",
        "notes": data.get("notes") or "",
    }


async def create_lead(data: dict):
    rows = await supabase_request(
        "POST",
        "/leads",
        params={"select": LEAD_SELECT},
        json=to_database_lead(data),
    )
    return normalize_lead(pick_first(rows, "Lead could not be created."))


async def create_lead_chat_messages(lead_id: str, messages: list[dict], session_id: str | None = ""):
    rows = []
    for index, message in enumerate(messages):
        role = message.get("role")
        content = message.get("content")
        if role not in ["user", "assistant", "system"] or not content:
            continue
        rows.append(
            {
                "lead_id": lead_id,
                "session_id": session_id or "",
                "role": role,
                "content": content,
                "message_order": index,
            }
        )

    if not rows:
        return []

    return await supabase_request("POST", "/lead_chat_messages", json=rows)


async def create_lead_voice_call(lead_id: str, data: dict):
    payload = {
        "lead_id": lead_id,
        "retell_call_id": data.get("callId") or None,
        "phone_number": data.get("phone") or "",
        "from_number": data.get("fromNumber") or "",
        "to_number": data.get("toNumber") or "",
        "call_status": data.get("callStatus") or "",
        "call_summary": data.get("callSummary") or "",
        "transcript": data.get("transcript") or "",
        "recording_url": data.get("recordingUrl") or "",
        "user_sentiment": data.get("userSentiment") or "",
        "call_successful": data.get("callSuccessful"),
        "custom_analysis_data": data.get("customAnalysisData") or {},
        "raw_payload": data.get("rawPayload") or {},
        "started_at": data.get("startedAt") or None,
        "ended_at": data.get("endedAt") or None,
        "duration_seconds": data.get("durationSeconds"),
    }
    rows = await supabase_request(
        "POST",
        "/lead_voice_calls",
        params={"select": VOICE_CALL_SELECT},
        json=payload,
    )
    return normalize_voice_call(pick_first(rows, "Voice call could not be saved."))


async def get_lead_chat_messages(lead_id: str):
    rows = await supabase_request(
        "GET",
        "/lead_chat_messages",
        params={
            "select": "id,lead_id,session_id,role,content,message_order,created_at",
            "lead_id": f"eq.{lead_id}",
            "order": "message_order.asc,created_at.asc",
        },
    )
    return rows or []


async def get_lead_voice_call(lead_id: str):
    rows = await supabase_request(
        "GET",
        "/lead_voice_calls",
        params={
            "select": VOICE_CALL_SELECT,
            "lead_id": f"eq.{lead_id}",
            "order": "created_at.desc",
            "limit": "1",
        },
    )
    return normalize_voice_call(pick_first(rows, "Voice call details not found."))


async def get_leads():
    rows = await supabase_request(
        "GET",
        "/leads",
        params={"select": LEAD_SELECT, "is_archived": "eq.false", "order": "created_at.desc"},
    )
    return [normalize_lead(row) for row in rows]


async def get_lead(lead_id: str):
    rows = await supabase_request(
        "GET",
        "/leads",
        params={"select": LEAD_SELECT, "id": f"eq.{lead_id}", "limit": "1"},
    )
    return normalize_lead(pick_first(rows, "Lead not found."))


async def get_archived_leads():
    rows = await supabase_request(
        "GET",
        "/leads",
        params={"select": LEAD_SELECT, "is_archived": "eq.true", "order": "archived_at.desc.nullslast,created_at.desc"},
    )
    return [normalize_lead(row) for row in rows]


async def update_lead_details(lead_id: str, data: dict):
    rows = await supabase_request(
        "PATCH",
        "/leads",
        params={"id": f"eq.{lead_id}", "select": LEAD_SELECT},
        json={
            "name": data["name"].strip(),
            "phone": data["phone"].strip(),
            "email": data["email"].strip(),
            "service": data["service"],
            "notes": data.get("notes") or "",
        },
    )
    return normalize_lead(pick_first(rows, "Lead not found."))


async def archive_lead(lead_id: str, archived: bool = True):
    rows = await supabase_request(
        "PATCH",
        "/leads",
        params={"id": f"eq.{lead_id}", "select": LEAD_SELECT},
        json={
            "is_archived": archived,
            "archived_at": datetime.now(timezone.utc).isoformat() if archived else None,
        },
    )
    return normalize_lead(pick_first(rows, "Lead not found."))


async def delete_lead(lead_id: str):
    rows = await supabase_request(
        "DELETE",
        "/leads",
        params={"id": f"eq.{lead_id}", "select": LEAD_SELECT},
    )
    return normalize_lead(pick_first(rows, "Lead not found."))


async def update_lead_status(lead_id: str, status: str):
    rows = await supabase_request(
        "PATCH",
        "/leads",
        params={"id": f"eq.{lead_id}", "select": LEAD_SELECT},
        json={"status": status},
    )
    return normalize_lead(pick_first(rows, "Lead not found."))


async def update_lead_followup(lead_id: str, followup: str):
    rows = await supabase_request(
        "PATCH",
        "/leads",
        params={"id": f"eq.{lead_id}", "select": LEAD_SELECT},
        json={"followup": followup},
    )
    return normalize_lead(pick_first(rows, "Lead not found."))

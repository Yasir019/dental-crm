from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import HTTPException

from app.db.supabase import supabase_request
from app.services.leads_service import get_lead
from app.services.utils import pick_first


CLINIC_TIMEZONE = ZoneInfo("Asia/Karachi")
OPEN_HOUR = 9
CLOSE_HOUR = 17
APPOINTMENT_SELECT = "id,lead_id,patient_name,patient_email,patient_phone,service,scheduled_start,scheduled_end,timezone,status,source,retell_call_id,notes,created_at,updated_at"
VALID_STATUSES = {"Scheduled", "Completed", "Cancelled", "No Show"}
VALID_SOURCES = {"AI Callback", "AI Voice Agent", "AI Chatbot", "Manual"}


def normalize_appointment(row: dict):
    return {
        "id": row["id"],
        "leadId": row.get("lead_id"),
        "patientName": row.get("patient_name") or "",
        "patientEmail": row.get("patient_email") or "",
        "patientPhone": row.get("patient_phone") or "",
        "service": row.get("service") or "",
        "scheduledStart": row["scheduled_start"],
        "scheduledEnd": row["scheduled_end"],
        "timezone": row.get("timezone") or "Asia/Karachi",
        "status": row.get("status") or "Scheduled",
        "source": row.get("source") or "Manual",
        "retellCallId": row.get("retell_call_id") or "",
        "notes": row.get("notes") or "",
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
    }


def parse_scheduled_start(value: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail={"message": "Use a valid appointment date and time."})
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=CLINIC_TIMEZONE)
    return parsed.astimezone(CLINIC_TIMEZONE)


def validate_business_hours(start: datetime, duration_minutes: int):
    end = start + timedelta(minutes=duration_minutes)
    opening = start.replace(hour=OPEN_HOUR, minute=0, second=0, microsecond=0)
    closing = start.replace(hour=CLOSE_HOUR, minute=0, second=0, microsecond=0)
    if start.weekday() >= 5:
        raise HTTPException(
            status_code=400,
            detail={"message": "The clinic is closed on Saturday and Sunday. Choose Monday to Friday, 9:00 AM to 5:00 PM."},
        )
    if start < opening or end > closing:
        raise HTTPException(
            status_code=400,
            detail={"message": "Appointments are available Monday to Friday between 9:00 AM and 5:00 PM."},
        )
    if start <= datetime.now(CLINIC_TIMEZONE):
        raise HTTPException(status_code=400, detail={"message": "Choose a future appointment time."})
    return end


async def find_conflict(start: datetime, end: datetime, exclude_id: str | None = None):
    rows = await supabase_request(
        "GET",
        "/appointments",
        params={
            "select": "id,scheduled_start,scheduled_end,status",
            "scheduled_start": f"lt.{end.astimezone(timezone.utc).isoformat()}",
            "scheduled_end": f"gt.{start.astimezone(timezone.utc).isoformat()}",
            "status": "eq.Scheduled",
        },
    )
    return next((row for row in (rows or []) if row["id"] != exclude_id), None)


async def suggest_slots(start: datetime, duration_minutes: int, count: int = 3):
    suggestions = []
    candidate = start.replace(second=0, microsecond=0)
    rounded_minutes = 30 if candidate.minute < 30 else 60
    candidate = candidate.replace(minute=0) + timedelta(minutes=rounded_minutes)
    while len(suggestions) < count:
        if candidate.weekday() >= 5:
            candidate = (candidate + timedelta(days=1)).replace(hour=OPEN_HOUR, minute=0)
            continue
        if candidate.hour < OPEN_HOUR:
            candidate = candidate.replace(hour=OPEN_HOUR, minute=0)
        end = candidate + timedelta(minutes=duration_minutes)
        if end.hour > CLOSE_HOUR or (end.hour == CLOSE_HOUR and end.minute > 0):
            candidate = (candidate + timedelta(days=1)).replace(hour=OPEN_HOUR, minute=0)
            continue
        if candidate > datetime.now(CLINIC_TIMEZONE) and not await find_conflict(candidate, end):
            suggestions.append(candidate.isoformat())
        candidate += timedelta(minutes=30)
    return suggestions


async def create_appointment(data: dict):
    lead = await get_lead(data["leadId"])
    start = parse_scheduled_start(data["scheduledStart"])
    duration = data.get("durationMinutes") or 30
    end = validate_business_hours(start, duration)
    if await find_conflict(start, end):
        alternatives = await suggest_slots(start, duration)
        raise HTTPException(
            status_code=409,
            detail={"message": "That appointment time is already booked.", "availableSlots": alternatives},
        )
    source = data.get("source") or "Manual"
    if source not in VALID_SOURCES:
        source = "Manual"
    rows = await supabase_request(
        "POST",
        "/appointments",
        params={"select": APPOINTMENT_SELECT},
        json={
            "lead_id": lead["id"],
            "patient_name": lead["name"],
            "patient_email": lead["email"],
            "patient_phone": lead["phone"],
            "service": lead["service"],
            "scheduled_start": start.astimezone(timezone.utc).isoformat(),
            "scheduled_end": end.astimezone(timezone.utc).isoformat(),
            "timezone": "Asia/Karachi",
            "status": "Scheduled",
            "source": source,
            "retell_call_id": data.get("retellCallId") or "",
            "notes": data.get("notes") or "",
        },
    )
    return normalize_appointment(pick_first(rows, "Appointment could not be created."))


async def get_appointments(start: str | None = None, end: str | None = None):
    params = {"select": APPOINTMENT_SELECT, "order": "scheduled_start.asc"}
    if start:
        params["scheduled_start"] = f"gte.{start}"
    if end:
        params["scheduled_end"] = f"lte.{end}"
    rows = await supabase_request("GET", "/appointments", params=params)
    return [normalize_appointment(row) for row in (rows or [])]


async def update_appointment(appointment_id: str, data: dict):
    current_rows = await supabase_request(
        "GET", "/appointments", params={"select": APPOINTMENT_SELECT, "id": f"eq.{appointment_id}", "limit": "1"}
    )
    current = pick_first(current_rows, "Appointment not found.")
    payload = {}
    if data.get("status") is not None:
        if data["status"] not in VALID_STATUSES:
            raise HTTPException(status_code=400, detail={"message": "Invalid appointment status."})
        payload["status"] = data["status"]
    if data.get("notes") is not None:
        payload["notes"] = data["notes"].strip()
    if data.get("scheduledStart") is not None:
        start = parse_scheduled_start(data["scheduledStart"])
        duration = data.get("durationMinutes") or max(
            15,
            int((datetime.fromisoformat(current["scheduled_end"]) - datetime.fromisoformat(current["scheduled_start"])).total_seconds() / 60),
        )
        end = validate_business_hours(start, duration)
        if await find_conflict(start, end, appointment_id):
            raise HTTPException(status_code=409, detail={"message": "That appointment time is already booked."})
        payload.update(
            {
                "scheduled_start": start.astimezone(timezone.utc).isoformat(),
                "scheduled_end": end.astimezone(timezone.utc).isoformat(),
            }
        )
    if not payload:
        return normalize_appointment(current)
    rows = await supabase_request(
        "PATCH", "/appointments", params={"id": f"eq.{appointment_id}", "select": APPOINTMENT_SELECT}, json=payload
    )
    return normalize_appointment(pick_first(rows, "Appointment could not be updated."))

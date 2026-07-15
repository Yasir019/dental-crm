import httpx
from fastapi import HTTPException
import re

from app.core.config import settings


RETELL_CREATE_WEB_CALL_URL = "https://api.retellai.com/v2/create-web-call"
RETELL_CREATE_PHONE_CALL_URL = "https://api.retellai.com/v2/create-phone-call"


def normalize_phone_e164(phone: str, default_country_code: str = "92") -> str:
    value = (phone or "").strip()
    if value.startswith("+"):
        international_digits = re.sub(r"\D", "", value[1:])
        normalized = f"+{international_digits}"
    else:
        digits = re.sub(r"\D", "", value)
        if digits.startswith("00"):
            normalized = f"+{digits[2:]}"
        elif digits.startswith(default_country_code):
            normalized = f"+{digits}"
        elif digits.startswith("0"):
            normalized = f"+{default_country_code}{digits[1:]}"
        else:
            normalized = f"+{default_country_code}{digits}"

    if not re.fullmatch(r"\+[1-9]\d{7,14}", normalized):
        raise HTTPException(
            status_code=400,
            detail={"message": "Lead phone number is invalid. Add a valid number such as +923041529500."},
        )
    return normalized


async def create_retell_web_call():
    if not settings.retell_api_key or not settings.retell_agent_id:
        raise HTTPException(
            status_code=500,
            detail={"message": "Retell web call is not configured. Add RETELL_API_KEY and RETELL_AGENT_ID."},
        )

    payload = {
        "agent_id": settings.retell_agent_id,
        "agent_version": "latest_published",
        "metadata": {
            "source": "website_voice_button",
            "crm_source": "AI Voice Agent",
        },
    }

    headers = {
        "Authorization": f"Bearer {settings.retell_api_key}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(RETELL_CREATE_WEB_CALL_URL, headers=headers, json=payload)
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail={"message": "Could not reach Retell to start the web call."})

    if response.status_code >= 400:
        error_detail = response.json() if "application/json" in response.headers.get("content-type", "") else {}
        raise HTTPException(
            status_code=502,
            detail={
                "message": "Retell could not create the web call.",
                "retellStatus": response.status_code,
                "retellError": error_detail,
            },
        )

    data = response.json()
    return {
        "accessToken": data.get("access_token"),
        "callId": data.get("call_id"),
        "agentId": data.get("agent_id"),
        "agentVersion": data.get("agent_version"),
    }


async def create_retell_phone_call(lead: dict):
    if not settings.retell_api_key or not settings.retell_agent_id or not settings.retell_phone_number:
        raise HTTPException(
            status_code=500,
            detail={"message": "Retell callback is not configured. Add RETELL_API_KEY, RETELL_AGENT_ID, and RETELL_PHONE_NUMBER."},
        )

    to_number = normalize_phone_e164(lead["phone"])
    payload = {
        "from_number": settings.retell_phone_number,
        "to_number": to_number,
        "metadata": {
            "source": "crm_followup_callback",
            "lead_id": lead["id"],
            "crm_source": lead.get("source") or "CRM",
            "call_purpose": "appointment_booking_callback",
        },
        "retell_llm_dynamic_variables": {
            "customer_name": lead["name"],
            "customer_email": lead["email"],
            "customer_phone": to_number,
            "dental_service": lead["service"],
            "lead_id": lead["id"],
            "call_purpose": "appointment_booking_callback",
            "clinic_timezone": "Asia/Karachi",
            "clinic_hours": "Monday to Friday, 9:00 AM to 5:00 PM",
        },
    }
    headers = {
        "Authorization": f"Bearer {settings.retell_api_key}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(RETELL_CREATE_PHONE_CALL_URL, headers=headers, json=payload)
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail={"message": "Could not reach Retell to start the callback."})

    if response.status_code >= 400:
        error_detail = response.json() if "application/json" in response.headers.get("content-type", "") else {}
        raise HTTPException(
            status_code=502,
            detail={
                "message": "Retell could not start the callback.",
                "retellStatus": response.status_code,
                "retellError": error_detail,
            },
        )

    data = response.json()
    return {
        "callId": data.get("call_id"),
        "callStatus": data.get("call_status") or "registered",
        "agentId": data.get("agent_id"),
        "fromNumber": data.get("from_number") or settings.retell_phone_number,
        "toNumber": data.get("to_number") or to_number,
    }

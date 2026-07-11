import httpx
from fastapi import HTTPException

from app.core.config import settings


RETELL_CREATE_WEB_CALL_URL = "https://api.retellai.com/v2/create-web-call"


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

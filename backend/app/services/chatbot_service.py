import httpx
from fastapi import HTTPException

from app.core.config import settings
from app.utils.service_catalog import SERVICE_CATALOG

async def send_chatbot_message(payload: dict):
    if not settings.n8n_chatbot_webhook_url:
        raise HTTPException(
            status_code=503,
            detail={"message": "AI chatbot workflow is not configured. Add N8N_CHATBOT_WEBHOOK_URL in backend/.env."},
        )

    payload.setdefault("serviceCatalog", SERVICE_CATALOG)
    headers = {"Content-Type": "application/json"}
    if settings.n8n_chatbot_secret:
        headers["x-chatbot-secret"] = settings.n8n_chatbot_secret

    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(settings.n8n_chatbot_webhook_url, headers=headers, json=payload)

    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail={"message": "AI chatbot workflow failed."})

    try:
        data = response.json()
    except ValueError:
        data = {"reply": response.text}

    return {
        "reply": data.get("reply") or data.get("message") or "Thanks. Our clinic team will follow up soon.",
        "leadCaptured": bool(data.get("leadCaptured")),
        "lead": data.get("lead"),
        "missingFields": data.get("missingFields") or [],
    }

import httpx
import re
from fastapi import HTTPException

from app.core.config import settings
from app.ai.prompts import chatbot_system_prompt
from app.utils.service_catalog import SERVICE_CATALOG, service_names_text


SERVICE_LIST_REQUEST = re.compile(
    r"\b(what services|which services|what type of services|what kind of services|services do you|services you provide|services you offer|what treatments|treatments do you offer|service list|available services)\b",
    re.IGNORECASE,
)


def is_service_list_request(message: str) -> bool:
    return bool(SERVICE_LIST_REQUEST.search(message or ""))


def service_list_reply() -> str:
    return (
        "We offer these dental services:\n\n"
        f"{service_names_text()}\n\n"
        "Which service are you looking for?"
    )

async def send_chatbot_message(payload: dict):
    # Keep the service directory complete and predictable even if an external
    # workflow returns an outdated or shortened knowledge-base response.
    if is_service_list_request(payload.get("message", "")):
        return {
            "reply": service_list_reply(),
            "leadCaptured": False,
            "lead": None,
            "missingFields": ["service"],
        }

    if not settings.n8n_chatbot_webhook_url:
        raise HTTPException(
            status_code=503,
            detail={"message": "AI chatbot workflow is not configured. Add N8N_CHATBOT_WEBHOOK_URL in backend/.env."},
        )

    payload.setdefault("serviceCatalog", SERVICE_CATALOG)
    payload.setdefault("knowledgeBase", SERVICE_CATALOG)
    payload.setdefault("agentType", "website_chatbot")
    payload.setdefault("systemPrompt", chatbot_system_prompt())
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

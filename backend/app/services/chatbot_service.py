import httpx
import re
from fastapi import HTTPException

from app.core.config import settings
from app.ai.prompts import chatbot_system_prompt
from app.utils.service_catalog import SERVICE_CATALOG, service_names_text


SERVICE_LIST_REQUEST = re.compile(
    r"\b(what services|which services|what type of services|what kind of services|services do you|services you provide|services you offer|do you offer|do you provide|what treatments|treatments do you offer|service list|available services)\b",
    re.IGNORECASE,
)
AVAILABILITY_REQUEST = re.compile(
    r"\b(working days|opening hours|open today|what hours|when are you open|available days|available time|clinic hours|schedule|hours)\b",
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


def availability_reply() -> str:
    return (
        "Our clinic hours are:\n\n"
        "- Monday to Friday: 9:00 AM to 5:00 PM\n"
        "- Saturday: Closed\n"
        "- Sunday: Closed\n\n"
        "What dental service are you looking for?"
    )


def specific_service_reply(message: str) -> str | None:
    normalized_message = (message or "").lower()
    for item in SERVICE_CATALOG:
        if item["name"].lower() in normalized_message:
            return f"Yes, we offer {item['name']}. {item['description']}\n\nWould you like help with {item['name']}?"
    return None

async def send_chatbot_message(payload: dict):
    # Keep the service directory complete and predictable even if an external
    # workflow returns an outdated or shortened knowledge-base response.
    message = payload.get("message", "")
    specific_service = specific_service_reply(message)
    if specific_service:
        return {
            "reply": specific_service,
            "leadCaptured": False,
            "lead": None,
            "missingFields": ["service"],
        }
    if AVAILABILITY_REQUEST.search(message or ""):
        return {
            "reply": availability_reply(),
            "leadCaptured": False,
            "lead": None,
            "missingFields": ["service"],
        }
    if is_service_list_request(message):
        return {
            "reply": service_list_reply(),
            "leadCaptured": False,
            "lead": None,
            "missingFields": ["service"],
        }

    if not settings.n8n_chatbot_webhook_url:
        return await fallback_chatbot_message(payload)

    payload.setdefault("serviceCatalog", SERVICE_CATALOG)
    payload.setdefault("knowledgeBase", SERVICE_CATALOG)
    payload.setdefault("agentType", "website_chatbot")
    payload.setdefault("systemPrompt", chatbot_system_prompt())
    headers = {"Content-Type": "application/json"}
    if settings.n8n_chatbot_secret:
        headers["x-chatbot-secret"] = settings.n8n_chatbot_secret

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(settings.n8n_chatbot_webhook_url, headers=headers, json=payload)
    except httpx.HTTPError:
        return await fallback_chatbot_message(payload)

    if response.status_code >= 400:
        return await fallback_chatbot_message(payload)

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


async def fallback_chatbot_message(payload: dict):
    """Keep the public assistant useful while the external workflow is unavailable."""
    fallback_reply = (
        "Thanks for contacting BrightSmile Dental Center. I can help with our dental services, "
        "clinic hours, or your inquiry. Which service are you interested in?"
    )

    if not settings.ai_api_key:
        return {
            "reply": fallback_reply,
            "leadCaptured": False,
            "lead": None,
            "missingFields": ["service"],
        }

    history = payload.get("history") or []
    messages = [
        {
            "role": "system",
            "content": (
                f"{chatbot_system_prompt()}\n\n"
                "The normal workflow is temporarily unavailable. Reply with only a short, natural "
                "message for the visitor. Do not claim that a lead or appointment was saved."
            ),
        }
    ]
    for item in history[-10:]:
        role = item.get("role")
        content = (item.get("content") or "").strip()
        if role in {"user", "assistant"} and content:
            messages.append({"role": role, "content": content})
    message = (payload.get("message") or "").strip()
    if message:
        messages.append({"role": "user", "content": message})

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{settings.ai_api_base_url.rstrip('/')}/chat/completions",
                headers={"Authorization": f"Bearer {settings.ai_api_key}"},
                json={
                    "model": settings.ai_model,
                    "messages": messages,
                    "temperature": 0.3,
                    "max_tokens": 180,
                },
            )
        if response.status_code < 400:
            content = response.json()["choices"][0]["message"]["content"].strip()
            if content:
                fallback_reply = content
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError):
        pass

    return {
        "reply": fallback_reply,
        "leadCaptured": False,
        "lead": None,
        "missingFields": ["service"],
    }

import json
import httpx
from .email_templates import fallback_template
from app.core.config import settings


async def generate_followup_template(name: str, service: str):
    if not settings.ai_api_key:
        return fallback_template(name, service)

    prompt = (
        f"Generate a polite dental clinic follow-up email for a patient named {name} "
        f"who showed interest in {service}. The email should be professional, friendly, "
        "and short. Do not provide medical advice or diagnosis. Ask the patient to reply "
        "with their preferred appointment time. Return JSON with subject and body."
    )

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            f"{settings.ai_api_base_url.rstrip('/')}/chat/completions",
            headers={"Authorization": f"Bearer {settings.ai_api_key}"},
            json={
                "model": settings.ai_model,
                "messages": [
                    {
                        "role": "system",
                        "content": "You write short, professional dental clinic follow-up emails. Never provide diagnosis or medical advice.",
                    },
                    {"role": "user", "content": prompt},
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.5,
            },
        )

    if response.status_code >= 400:
        return fallback_template(name, service)

    try:
        content = response.json()["choices"][0]["message"]["content"]
        parsed = json.loads(content)
        return {
            "subject": parsed.get("subject") or fallback_template(name, service)["subject"],
            "body": parsed.get("body") or fallback_template(name, service)["body"],
        }
    except Exception:
        return fallback_template(name, service)

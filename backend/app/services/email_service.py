import httpx
from fastapi import HTTPException
from app.core.config import settings


async def send_email(to: str, subject: str, body: str):
    if not settings.email_api_key or not settings.email_from:
        raise HTTPException(status_code=500, detail={"message": "Email service is not configured."})

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.email_api_key}"},
            json={"from": settings.email_from, "to": [to], "subject": subject, "text": body},
        )

    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail={"message": "Email could not be sent."})
    return response.json()
